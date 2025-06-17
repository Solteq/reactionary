import { initTRPC } from '@trpc/server';
import {
  Analytics,
  AnalyticsEventSchema,
  CartGetPayloadSchema,
  CartItemAddPayloadSchema,
  CartItemAdjustPayloadSchema,
  CartItemRemovePayloadSchema,
  CartSchema,
  Client,
  IdentityLoginPayloadSchema,
  IdentitySchema,
  InventorySchema,
  PriceQuerySchema,
  PriceSchema,
  ProductQuerySchema,
  ProductSchema,
  SearchIdentifierSchema,
  SearchResultSchema,
  Session,
} from '@reactionary/core';
import superjson from 'superjson';
import { InventoryQuerySchema } from 'core/src/schemas/queries/inventory.query';

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
      return opts.ctx.client.product.query(opts.input, opts.ctx.session);
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
  inventory: publicProcedure
    .input(InventoryQuerySchema)
    .output(InventorySchema)
    .query(async (opts) => {
      return opts.ctx.client.inventory.query(opts.input, opts.ctx.session);
    }),
  price: publicProcedure
    .input(PriceQuerySchema)
    .output(PriceSchema)
    .query(async (opts) => {
      return opts.ctx.client.price.query(opts.input, opts.ctx.session);
    }),
  cart: router({
    get: publicProcedure
      .input(CartGetPayloadSchema)
      .output(CartSchema)
      .query(async (opts) => {
        return opts.ctx.client.cart.get(opts.input, opts.ctx.session);
      }),
    add: publicProcedure
      .input(CartItemAddPayloadSchema)
      .output(CartSchema)
      .mutation(async (opts) => {
        return opts.ctx.client.cart.add(opts.input, opts.ctx.session);
      }),
    adjust: publicProcedure
      .input(CartItemAdjustPayloadSchema)
      .output(CartSchema)
      .mutation(async (opts) => {
        return opts.ctx.client.cart.adjust(opts.input, opts.ctx.session);
      }),
    remove: publicProcedure
      .input(CartItemRemovePayloadSchema)
      .output(CartSchema)
      .mutation(async (opts) => {
        return opts.ctx.client.cart.remove(opts.input, opts.ctx.session);
      })
  }),
});

export type RouterType = typeof appRouter;
