// Re-export server utilities
export {
  createTRPCServerRouter,
  createTRPCContext,
  router,
  mergeRouters,
  type TRPCRouterFromClient
} from './server';

// Re-export client utilities
export {
  createTRPCClient,
  createTRPCClientWithSessionProvider,
  type TRPCClientOptions,
  type SessionProvider,
  type TRPCClientFromRouter
} from './client';

// Re-export type utilities
export {
  type ClientMethodMap,
  type MethodInfo,
  type TRPCMethodInput,
  type TransparentClient,
  introspectClient,
  isQueryMethod,
  isMutationMethod
} from './types';

// Legacy exports for backward compatibility
import { initTRPC } from '@trpc/server';
import type { Client, RequestContext} from '@reactionary/core';
import { Session } from '@reactionary/core';
import { createTRPCTracing } from '@reactionary/otel';

const t = initTRPC.context<{ client: Client; reqCtx: RequestContext }>().create({});

// Always apply tracing middleware - exporters controlled via OTEL env vars
const basePublicProcedure = t.procedure;
export const publicProcedure = basePublicProcedure.use(createTRPCTracing());

// Legacy function - deprecated, use createTRPCServerRouter instead
import { createTRPCServerRouter } from './server';
export const createTRPCRouter = createTRPCServerRouter;
