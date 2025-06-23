import { initTRPC } from '@trpc/server';
import {
    Client,
  ProductQuerySchema,
  ProductSchema,
  SearchIdentifierSchema,
  SearchResultSchema,
} from '@reactionary/core';

const t = initTRPC.context<{ client: Client }>().create();

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
    .input(ProductQuerySchema.array())
    .output(ProductSchema.array())
    .query(async (opts) => {
      return opts.ctx.client.product.query(opts.input, {
        
      });
    }),
});

export type RouterType = typeof appRouter;
