import { initTRPC } from '@trpc/server';
import type { Client, RequestContext, Session } from '@reactionary/core';
import superjson from 'superjson';
import { z } from 'zod';
import { createTRPCTracing } from '@reactionary/otel';
import type {
  MethodInfo
} from './types';
import {
  introspectClient
} from './types';

// Initialize TRPC with context containing session (no transformer for testing)
const t = initTRPC.context<{ reqCtx?: RequestContext }>().create();

export const router = t.router;
export const mergeRouters = t.mergeRouters;

// Apply tracing middleware
const baseProcedure = t.procedure.use(createTRPCTracing());

/**
 * Create a TRPC router from a built client instance
 * This function introspects the client and automatically creates TRPC procedures
 * for all provider methods while maintaining type safety
 *
 * @example
 * ```typescript
 * const client = buildClient([
 *   withFakeCapabilities(config, { product: true, search: true })
 * ]);
 *
 * const router = createTRPCServerRouter(client);
 * ```
 */
export function createTRPCServerRouter<T extends Partial<Client>>(client: T) {
  const methods = introspectClient(client);

  // Group methods by provider
  const providerMethods = methods.reduce((acc, method) => {
    if (!acc[method.providerName]) {
      acc[method.providerName] = [];
    }
    acc[method.providerName].push(method);
    return acc;
  }, {} as Record<string, MethodInfo[]>);

  // Build router structure
  const routes: Record<string, any> = {};

  for (const [providerName, providerMethodsList] of Object.entries(providerMethods)) {
    const providerRoutes: Record<string, any> = {};

    for (const methodInfo of providerMethodsList) {
      const procedure = createProcedureForMethod(methodInfo);
      providerRoutes[methodInfo.name] = procedure;
    }

    routes[providerName] = t.router(providerRoutes);
  }

  return t.router(routes);
}

/**
 * Create a TRPC procedure for a specific provider method
 */
function createProcedureForMethod(methodInfo: MethodInfo) {
  // Create input schema - we use a flexible schema since we want to preserve
  // the original method signatures without requiring schema definitions
  const inputSchema = z.object({
    payload: z.any(), // The actual payload from the provider method
    reqCtx: z.any().optional(), // Session is optional in input since it might come from context
  });

  const procedureWithInput = baseProcedure.input(inputSchema);

  if (methodInfo.isQuery) {
    return procedureWithInput.query(async ({ input, ctx }) => {
      const reqCtx = input.reqCtx || ctx.reqCtx;

      // Call the original provider method
      if (reqCtx) {
        return await methodInfo.method(input.payload, reqCtx);
      } else {
        // Some methods might not require session
        return await methodInfo.method(input.payload);
      }
    });
  } else if (methodInfo.isMutation) {
    return procedureWithInput.mutation(async ({ input, ctx }) => {
      const reqCtx = input.reqCtx || ctx.reqCtx;

      // Call the original provider method
      if (reqCtx) {
        return await methodInfo.method(input.payload, reqCtx);
      } else {
        // Some methods might not require session
        return await methodInfo.method(input.payload);
      }
    });
  } else {
    throw new Error(`Method ${methodInfo.name} is neither query nor mutation`);
  }
}

/**
 * Type helper to extract the router type from a client
 * This enables full type safety on the client side
 */
export type TRPCRouterFromClient<T extends Partial<Client>> = ReturnType<typeof createTRPCServerRouter<T>>;

/**
 * Context creator for TRPC server
 * Override this to provide session from your authentication system
 */
export function createTRPCContext(_opts: { req?: any; res?: any }) {
  // Default implementation - you should override this based on your auth system
  return {
    reqCtx: undefined as RequestContext | undefined,
  };
}

// Create publicProcedure here to avoid circular imports
export const publicProcedure = baseProcedure;
