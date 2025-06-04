import { initTRPC } from '@trpc/server';
import {
  AnalyticsEventSchema,
  Client,
  ProductQuerySchema,
  ProductSchema,
  SearchIdentifierSchema,
  SearchResultSchema,
  Session,
} from '@reactionary/core';

const t = initTRPC.context<{ client: Client, session: Session }>().create();

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
      console.log(opts);
    })
});

export type RouterType = typeof appRouter;
