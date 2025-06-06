import { initTRPC } from '@trpc/server';
import {
  Analytics,
  AnalyticsEventSchema,
  Client,
  IdentityLoginPayloadSchema,
  IdentitySchema,
  ProductQuerySchema,
  ProductSchema,
  SearchIdentifierSchema,
  SearchResultSchema,
  Session,
} from '@reactionary/core';
import superjson from 'superjson';

const t = initTRPC.context<{ client: Client; session: Session }>().create({
  transformer: superjson,
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure;

export const appRouter = router({
  search: publicProcedure
    .input(SearchIdentifierSchema)
    .output(SearchResultSchema)
    .query(async (opts) => {
      const result = await opts.ctx.client.search.get(opts.input);

      return result;
    }),
  product: publicProcedure
    .input(ProductQuerySchema)
    .output(ProductSchema)
    .query(async (opts) => {
      return opts.ctx.client.product.get(opts.input);
    }),
  analytics: publicProcedure
    .input(AnalyticsEventSchema)
    .mutation(async (opts) => {
      const analytics = new Analytics(opts.ctx.client.analytics);

      analytics.publish(opts.input, opts.ctx.session);

      await analytics.shutdown();
    }),
  identity: publicProcedure.output(IdentitySchema).query(async (opts) => {
    return opts.ctx.client.identity.get(opts.ctx.session);
  }),
  login: publicProcedure
    .input(IdentityLoginPayloadSchema)
    .output(IdentitySchema)
    .mutation(async (opts) => {
      return opts.ctx.client.identity.login(opts.input, opts.ctx.session);
    }),
  logout: publicProcedure.output(IdentitySchema).mutation(async (opts) => {
    return opts.ctx.client.identity.logout(opts.ctx.session);
  }),
});

export type RouterType = typeof appRouter;
