import { describe, expect, it, vi } from 'vitest';
import { createInitialRequestContext } from '../initialization.js';
import { createAnalyticsContext, error, success } from '../index.js';
import type { AnalyticsLookupCapabilities, Cart, Company, Inventory, Order, Price, Product, Profile, Result, Store } from '../index.js';

const product = (key: string) => ({ identifier: { key } }) as unknown as Product;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function build(capabilities: AnalyticsLookupCapabilities, concurrency?: number) {
  const requestContext = createInitialRequestContext();
  return { requestContext, ctx: createAnalyticsContext({ capabilities, requestContext, concurrency }) };
}

describe('AnalyticsContext', () => {
  describe('products', () => {
    it('memoizes lookups per context', async () => {
      const getById = vi.fn(async ({ identifier }: { identifier: { key: string } }): Promise<Result<Product>> => success(product(identifier.key)));
      const { ctx } = build({ product: { getById, getBySKU: vi.fn() } });

      const [a, b] = await Promise.all([ctx.products.byId({ key: 'p1' }), ctx.products.byId({ key: 'p1' })]);
      await ctx.products.byId({ key: 'p1' });

      expect(getById).toHaveBeenCalledTimes(1);
      expect(a).toBe(b);
    });

    it('does not share memoized results between contexts', async () => {
      const getById = vi.fn(async ({ identifier }: { identifier: { key: string } }): Promise<Result<Product>> => success(product(identifier.key)));
      const capabilities = { product: { getById, getBySKU: vi.fn() } };

      await build(capabilities).ctx.products.byId({ key: 'p1' });
      await build(capabilities).ctx.products.byId({ key: 'p1' });

      expect(getById).toHaveBeenCalledTimes(2);
    });

    it('looks up by sku', async () => {
      const getBySKU = vi.fn(async (): Promise<Result<Product>> => success(product('p1')));
      const { ctx } = build({ product: { getById: vi.fn(), getBySKU } });

      await ctx.products.bySku({ sku: 's1' });

      expect(getBySKU).toHaveBeenCalledWith({ variant: { sku: 's1' } });
    });

    it('limits concurrency in many, keeps input order and keeps failures as error results', async () => {
      let running = 0;
      let peak = 0;
      const getById = vi.fn(async ({ identifier }: { identifier: { key: string } }): Promise<Result<Product>> => {
        running++;
        peak = Math.max(peak, running);
        await delay(5);
        running--;
        return identifier.key === 'bad' ? error({ type: 'NotFound', identifier }) : success(product(identifier.key));
      });
      const { ctx } = build({ product: { getById, getBySKU: vi.fn() } }, 2);

      const results = await ctx.products.many([{ key: 'a' }, { key: 'bad' }, { key: 'c' }, { key: 'd' }, { key: 'a' }]);

      expect(peak).toBeLessThanOrEqual(2);
      expect(results.map((r) => r.success)).toEqual([true, false, true, true, true]);
      expect(getById).toHaveBeenCalledTimes(4);
    });

    it('returns an error result when the capability is not configured', async () => {
      const { ctx } = build({});

      const result = await ctx.products.byId({ key: 'p1' });

      expect(result.success).toBe(false);
      expect(!result.success && result.error).toMatchObject({ type: 'Generic', message: expect.stringContaining('product') });
    });
  });

  describe('prices', () => {
    const price = (value: number) => ({ unitPrice: { value, currency: 'EUR' } }) as unknown as Price;

    it('returns both prices', async () => {
      const { ctx } = build({
        price: { getCustomerPrice: async () => success(price(8)), getListPrice: async () => success(price(10)) },
      });

      const result = await ctx.prices.forSku({ sku: 's1' });

      expect(result.success && result.value).toEqual({ customer: price(8), list: price(10) });
    });

    it('degrades to the price that resolved', async () => {
      const { ctx } = build({
        price: { getCustomerPrice: async () => error({ type: 'NotFound', identifier: 's1' }), getListPrice: async () => success(price(10)) },
      });

      const result = await ctx.prices.forSku({ sku: 's1' });

      expect(result.success && result.value).toEqual({ customer: undefined, list: price(10) });
    });

    it('fails only when neither resolved', async () => {
      const { ctx } = build({
        price: {
          getCustomerPrice: async () => error({ type: 'NotFound', identifier: 's1' }),
          getListPrice: async () => error({ type: 'NotFound', identifier: 's1' }),
        },
      });

      expect((await ctx.prices.forSku({ sku: 's1' })).success).toBe(false);
    });
  });

  describe('inventory', () => {
    it("asks the request store's fulfilment center", async () => {
      const getBySKU = vi.fn(async (): Promise<Result<Inventory, { type: 'NotFound'; identifier: unknown }>> => success({} as unknown as Inventory));
      const store = { identifier: { key: 'store-1' }, fulfillmentCenter: { key: 'fc-1' } } as unknown as Store;
      const storeGetById = vi.fn(async (): Promise<Result<Store, { type: 'NotFound'; identifier: unknown }>> => success(store));
      const { ctx, requestContext } = build({ inventory: { getBySKU }, store: { getById: storeGetById } });
      requestContext.storeIdentifier = { key: 'store-1' };

      await ctx.inventory.forSku({ sku: 's1' });

      expect(storeGetById).toHaveBeenCalledWith({ identifier: { key: 'store-1' } });
      expect(getBySKU).toHaveBeenCalledWith({ variant: { sku: 's1' }, fulfilmentCenter: { key: 'fc-1' } });
    });

    it('fails when the store cannot be resolved', async () => {
      const { ctx } = build({ inventory: { getBySKU: vi.fn() } });

      expect((await ctx.inventory.forSku({ sku: 's1' })).success).toBe(false);
    });
  });

  describe('cart and orders', () => {
    const cart = { identifier: { key: 'c1' }, company: { taxIdentifier: 'tax-1' } } as unknown as Cart;

    it('resolves the active cart from the active cart id, once', async () => {
      const getActiveCartId = vi.fn(async () => success({ key: 'c1' }));
      const getById = vi.fn(async (): Promise<Result<Cart, { type: 'NotFound'; identifier: unknown }>> => success(cart));
      const { ctx } = build({ cart: { getActiveCartId, getById } });

      await ctx.cart.active();
      const result = await ctx.cart.active();

      expect(getById).toHaveBeenCalledWith({ cart: { key: 'c1' } });
      expect(getActiveCartId).toHaveBeenCalledTimes(1);
      expect(result.success && result.value).toBe(cart);
    });

    it('propagates a missing active cart', async () => {
      const { ctx } = build({
        cart: { getActiveCartId: async () => error({ type: 'NotFound', identifier: 'none' }), getById: vi.fn() },
      });

      const result = await ctx.cart.active();

      expect(!result.success && result.error).toMatchObject({ type: 'NotFound' });
    });

    it('looks up orders and stores by id', async () => {
      const orderGetById = vi.fn(async (): Promise<Result<Order, { type: 'NotFound'; identifier: unknown }>> => success({} as unknown as Order));
      const storeGetById = vi.fn(async (): Promise<Result<Store, { type: 'NotFound'; identifier: unknown }>> => success({} as unknown as Store));
      const { ctx } = build({ order: { getById: orderGetById }, store: { getById: storeGetById } });

      await ctx.orders.byId({ key: 'o1' });
      await ctx.stores.byId({ key: 's1' });

      expect(orderGetById).toHaveBeenCalledWith({ order: { key: 'o1' } });
      expect(storeGetById).toHaveBeenCalledWith({ identifier: { key: 's1' } });
    });

    it('resolves the company of the active cart for self.company', async () => {
      const company = { name: 'Acme' } as unknown as Company;
      const companyGetById = vi.fn(async (): Promise<Result<Company>> => success(company));
      const { ctx } = build({
        cart: { getActiveCartId: async () => success({ key: 'c1' }), getById: async () => success(cart) },
        company: { getById: companyGetById },
      });

      const result = await ctx.self.company();

      expect(companyGetById).toHaveBeenCalledWith({ identifier: { taxIdentifier: 'tax-1' } });
      expect(result.success && result.value).toBe(company);
    });

    it('answers NotFound for self.company when the cart has no company', async () => {
      const personalCart = { identifier: { key: 'c2' } } as unknown as Cart;
      const { ctx } = build({
        cart: { getActiveCartId: async () => success({ key: 'c2' }), getById: async () => success(personalCart) },
        company: { getById: vi.fn() },
      });

      const result = await ctx.self.company();

      expect(!result.success && result.error).toMatchObject({ type: 'NotFound' });
    });
  });

  describe('self', () => {
    it('does not look up a profile for anonymous visitors', async () => {
      const getById = vi.fn();
      const { ctx } = build({ profile: { getById } });

      const result = await ctx.self.profile();

      expect(getById).not.toHaveBeenCalled();
      expect(!result.success && result.error).toMatchObject({ type: 'NotFound' });
    });

    it('looks up the profile of the current identity only', async () => {
      const getById = vi.fn(async (): Promise<Result<Profile, { type: 'NotFound'; identifier: unknown }>> => success({} as unknown as Profile));
      const { ctx, requestContext } = build({ profile: { getById } });
      requestContext.session.identityContext.identity = { type: 'Registered', id: { userId: 'u1' } };

      await ctx.self.profile();

      expect(getById).toHaveBeenCalledWith({ identifier: { userId: 'u1' } });
    });

    it('asks for the personalization profile of the session marketing identifier', async () => {
      const getPersonalizationProfile = vi.fn(async () => error({ type: 'NotFound' as const, identifier: 'x' }));
      const { ctx, requestContext } = build({ personalizationProfile: { getPersonalizationProfile } });
      requestContext.session.marketingContext.identifier.key = 'visitor-1';

      await ctx.self.personalization();

      expect(getPersonalizationProfile).toHaveBeenCalledWith({
        identity: { type: 'Anonymous' },
        personalizationProfileIdentifier: { key: 'visitor-1' },
      });
    });

    it('exposes no mutation access', () => {
      const { ctx } = build({});
      const lookups = [ctx.products, ctx.categories, ctx.prices, ctx.inventory, ctx.cart, ctx.orders, ctx.stores, ctx.self];

      for (const group of lookups) {
        for (const name of Object.keys(group)) {
          expect(name).not.toMatch(/^(add|remove|update|create|delete|set|login|logout|register|apply|change)/);
        }
      }
    });
  });
});
