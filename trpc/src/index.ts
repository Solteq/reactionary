import { initTRPC } from '@trpc/server';
import {
  Client,
  Session,
} from '@reactionary/core';
import superjson from 'superjson';
import { z } from 'zod';
import { BaseProvider } from '@reactionary/core';
import { TRPCQueryProcedure, TRPCMutationProcedure } from '@trpc/server';
import { createTRPCTracing } from '@reactionary/otel';

const t = initTRPC.context<{ client: Client; session: Session }>().create({
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;

// Always apply tracing middleware - exporters controlled via OTEL env vars
const basePublicProcedure = t.procedure;
export const publicProcedure = basePublicProcedure.use(createTRPCTracing());

export function createTRPCRouter<T extends Partial<Client>>(client: T) {
  type BaseProviderKeys<C> = {
    [K in keyof C]: C[K] extends BaseProvider ? K : never;
  }[keyof C];

  type QueryRouter<C> = {
    [K in BaseProviderKeys<C>]: C[K] extends BaseProvider ? TRPCQueryProcedure<{
      input: Array<z.infer<C[K]['querySchema']>>;
      output: Array<z.infer<Awaited<C[K]['schema']>>>;
      meta: any;
    }> : never;
  };

  type MutationRouter<C> = {
    [K in BaseProviderKeys<C> as `${K & string}Mutation`]: C[K] extends BaseProvider ? TRPCMutationProcedure<{
      input: Array<z.infer<C[K]['mutationSchema']>>;
      output: z.infer<Awaited<C[K]['schema']>>;
      meta: any;
    }> : never;
  };

  type ReactionaryRouter = QueryRouter<T> & MutationRouter<T>;

  const routes: Record<string, any> = {};
  // Always enable tracing - exporters are controlled via env vars
  const procedure = basePublicProcedure.use(createTRPCTracing());

  for (const key in client) {
    const provider = client[key];

    if (provider instanceof BaseProvider) {
      const queryKey = key as string;
      const mutationKey = `${key}Mutation`;

      routes[queryKey] = procedure
        .input(provider.querySchema.array())
        .output(provider.schema.array())
        .query(async (opts) => {
          return provider.query(opts.input, opts.ctx.session);
        });

      routes[mutationKey] = procedure
        .input(provider.mutationSchema.array())
        .output(provider.schema)
        .mutation(async (opts) => {
          return provider.mutate(opts.input, opts.ctx.session);
        });
    }
  }

  return router<ReactionaryRouter>(routes as ReactionaryRouter);
}
