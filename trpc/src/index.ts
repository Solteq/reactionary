import { initTRPC } from '@trpc/server';
import {
  Client,
  Session,
} from '@reactionary/core';
import superjson from 'superjson';
import { z } from 'zod';
import { BaseProvider } from 'core/src/providers/base.provider';
import {
  QueryProcedure,
  MutationProcedure,
} from '@trpc/server/dist/unstable-core-do-not-import';

const t = initTRPC.context<{ client: Client; session: Session }>().create({
  transformer: superjson,
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure;

export function createTRPCRouter<T extends Client = Client>(client: T) {
  type BaseProviderKeys<T> = {
    [K in keyof T]: T[K] extends BaseProvider ? K : never;
  }[keyof T];

  type ReactionaryRouter = {
    [Property in BaseProviderKeys<Client>]: QueryProcedure<{
      input: Array<z.infer<T[Property]['querySchema']>>;
      output: Array<z.infer<Awaited<T[Property]['schema']>>>;
      meta: any;
    }>;
  } & {
    [Property in BaseProviderKeys<Client> as `${Property}Mutation`]: MutationProcedure<{
      input: Array<z.infer<T[Property]['mutationSchema']>>;
      output: z.infer<Awaited<T[Property]['schema']>>;
      meta: any;
    }>;
  };

  const routes: Record<string, any> = {};

  for (const key in client) {
    const provider = client[key];

    if (provider instanceof BaseProvider) {
      const queryKey = key as keyof ReactionaryRouter;
      const mutationKey = key + 'Mutation' as keyof ReactionaryRouter;

      routes[queryKey] = publicProcedure
        .input(provider.querySchema.array())
        .output(provider.schema.array())
        .query(async (opts) => {
          return provider.query(opts.input, opts.ctx.session);
        });

      routes[mutationKey] = publicProcedure
        .input(provider.mutationSchema.array())
        .output(provider.schema)
        .mutation(async (opts) => {
          return provider.mutate(opts.input, opts.ctx.session);
        });
    }
  }

  return router<ReactionaryRouter>(routes as ReactionaryRouter);
}
