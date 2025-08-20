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
  transformer: superjson,
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;

const basePublicProcedure = t.procedure;
export const publicProcedure = basePublicProcedure.use(createTRPCTracing());

export function createTracedProcedure(options?: Parameters<typeof createTRPCTracing>[0]) {
  return basePublicProcedure.use(createTRPCTracing(options));
}

export function createTRPCRouter<T extends Client = Client>(client: T, enableTracing = true) {
  type BaseProviderKeys<T> = {
    [K in keyof T]: T[K] extends BaseProvider ? K : never;
  }[keyof T];

  type ReactionaryRouter = {
    [Property in BaseProviderKeys<Client>]: TRPCQueryProcedure<{
      input: Array<z.infer<T[Property]['querySchema']>>;
      output: Array<z.infer<Awaited<T[Property]['schema']>>>;
      meta: any;
    }>;
  } & {
    [Property in BaseProviderKeys<Client> as `${Property}Mutation`]: TRPCMutationProcedure<{
      input: Array<z.infer<T[Property]['mutationSchema']>>;
      output: z.infer<Awaited<T[Property]['schema']>>;
      meta: any;
    }>;
  };

  const routes: Record<string, any> = {};
  const procedure = enableTracing 
    ? basePublicProcedure.use(createTRPCTracing())
    : basePublicProcedure;

  for (const key in client) {
    const provider = client[key];

    if (provider instanceof BaseProvider) {
      const queryKey = key as keyof ReactionaryRouter;
      const mutationKey = key + 'Mutation' as keyof ReactionaryRouter;

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
