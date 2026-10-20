import {
  CartIdentifierSchema,
  CartPaginatedSearchResultSchema,
  CartSchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { describe, expect, it, vi } from 'vitest';
import { MagentoCartCapability } from '../capabilities/cart.capability.js';
import type { MagentoClient } from '../core/client.js';
import { MagentoApiError } from '../core/errors.js';
import { MagentoCartFactory } from '../factories/cart/cart.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoCartData } from '../schema/cart.types.js';
import type {
  MagentoCart,
  MagentoCartItem,
  MagentoCartTotals,
} from '../schema/magento.types.js';

const config: MagentoConfiguration = {
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
  authStoreCode: 'default',
};

const GUEST_KEY = 'masked-guest-1';

function apiError(status: number, message = 'boom'): MagentoApiError {
  return new MagentoApiError({
    transport: 'rest',
    status,
    method: 'GET',
    url: 'https://example.com/rest/V1/x',
    magentoMessage: message,
  });
}

function item(id: number, sku: string, qty = 1): MagentoCartItem {
  return { item_id: id, sku, qty, price: 10 };
}

/**
 * An in-memory Magento quote store plus a request session, behind the subset
 * of `MagentoClient` the cart capability uses.
 */
function createBackend(options: { customerToken?: string } = {}) {
  const quotes = new Map<string, MagentoCart>();
  const totals = new Map<string, MagentoCartTotals>();
  const session = new Map<string, string>();
  let active: string | null = null;
  let nextId = 1;

  /** A signed-in customer is served `carts/mine`, stored under '', for any key. */
  function quote(key: string | null | undefined): MagentoCart {
    const found = quotes.get(options.customerToken ? '' : (key ?? ''));
    if (!found) {
      throw apiError(404, 'No such entity with cartId');
    }
    return found;
  }

  const magentoApi = {
    getCustomerToken: vi.fn(async () => options.customerToken ?? null),
    getActiveCartId: vi.fn(async () => active),
    setActiveCartId: vi.fn(async (key: string) => {
      active = key;
    }),
    clearActiveCartId: vi.fn(async () => {
      active = null;
    }),
    getSessionItem: vi.fn(async (key: string) => session.get(key) ?? null),
    setSessionItem: vi.fn(async (key: string, value: string) => {
      session.set(key, value);
    }),
    removeSessionItem: vi.fn(async (key: string) => {
      session.delete(key);
    }),
    createCart: vi.fn(async () => {
      const id = nextId++;
      const key = `masked-new-${id}`;
      quotes.set(key, { id, items: [], customer: {}, currency: { quote_currency_code: 'EUR' } });
      return key;
    }),
    getCart: vi.fn(async (key?: string | null) => structuredClone(quote(key))),
    getCartTotals: vi.fn(async (key?: string | null): Promise<MagentoCartTotals> => {
      const q = quote(key);
      return structuredClone(
        totals.get(key ?? '') ?? {
          quote_currency_code: 'EUR',
          grand_total: q.items.reduce((sum, i) => sum + i.price * i.qty, 0),
          items: q.items,
        },
      );
    }),
    addItemToCart: vi.fn(async (key: string | null, input: { sku: string; qty: number }) => {
      const q = quote(key);
      const added = item(100 + q.items.length, input.sku, input.qty);
      q.items.push(added);
      return added;
    }),
    updateCartItem: vi.fn(async (key: string | null, itemId: number, input: { qty: number }) => {
      const q = quote(key);
      const target = q.items.find((i) => i.item_id === itemId);
      if (!target) {
        throw apiError(404);
      }
      target.qty = input.qty;
      return target;
    }),
    removeCartItem: vi.fn(async (key: string | null, itemId: number) => {
      const q = quote(key);
      q.items = q.items.filter((i) => i.item_id !== itemId);
      return true;
    }),
    applyCoupon: vi.fn(async () => true),
    removeCoupon: vi.fn(async () => true),
  };

  const capability = new MagentoCartCapability(
    config,
    new NoOpCache(),
    createInitialRequestContext(),
    magentoApi as unknown as MagentoClient,
    new MagentoCartFactory(CartSchema, CartIdentifierSchema, CartPaginatedSearchResultSchema),
  );

  return {
    capability,
    magentoApi,
    quotes,
    totals,
    session,
    setActive: (key: string | null) => {
      active = key;
    },
    getActive: () => active,
  };
}

function guestBackend(items: MagentoCartItem[] = [item(1, 'SKU-1')]) {
  const backend = createBackend();
  backend.quotes.set(GUEST_KEY, {
    id: 42,
    items,
    customer: {},
    currency: { quote_currency_code: 'EUR' },
  });
  backend.setActive(GUEST_KEY);
  return backend;
}

const LIST_QUERY = { search: { paginationOptions: { pageNumber: 1, pageSize: 20 } } };

describe('MagentoCartCapability.getById', () => {
  it('returns the cart keyed by the masked id it was asked for', async () => {
    const { capability } = guestBackend();
    const result = await capability.getById({ cart: { key: GUEST_KEY } });
    expect(result.success && result.value.identifier.key).toBe(GUEST_KEY);
  });

  it('maps a Magento 404 to NotFound', async () => {
    const { capability } = guestBackend();
    const result = await capability.getById({ cart: { key: 'unknown' } });
    expect(result).toMatchObject({ success: false, error: { type: 'NotFound' } });
  });

  it('maps other failures to Generic instead of NotFound', async () => {
    const backend = guestBackend();
    backend.magentoApi.getCart.mockRejectedValueOnce(apiError(500));
    const result = await backend.capability.getById({ cart: { key: GUEST_KEY } });
    expect(result).toMatchObject({ success: false, error: { type: 'Generic' } });
  });

  it('propagates a totals failure instead of returning a cart without prices', async () => {
    const backend = guestBackend();
    backend.magentoApi.getCartTotals.mockRejectedValueOnce(apiError(503));
    const result = await backend.capability.getById({ cart: { key: GUEST_KEY } });
    expect(result).toMatchObject({ success: false, error: { type: 'Generic' } });
  });

  it('returns NotFound for an empty key without a customer token', async () => {
    const backend = guestBackend();
    const result = await backend.capability.getById({ cart: { key: '' } });
    expect(result).toMatchObject({ success: false, error: { type: 'NotFound' } });
    expect(backend.magentoApi.getCart).not.toHaveBeenCalled();
  });
});

describe('MagentoCartCapability.add', () => {
  it('adds to the active cart when the key is empty', async () => {
    const backend = guestBackend([]);
    const result = await backend.capability.add({
      cart: { key: '' },
      variant: { sku: 'SKU-9' },
      quantity: 2,
    });
    expect(result.success && result.value.identifier.key).toBe(GUEST_KEY);
    expect(backend.magentoApi.createCart).not.toHaveBeenCalled();
    expect(backend.magentoApi.addItemToCart).toHaveBeenCalledWith(GUEST_KEY, { sku: 'SKU-9', qty: 2 });
  });

  it('creates a new cart when the key is empty and there is no active cart', async () => {
    const backend = createBackend();
    const result = await backend.capability.add({
      cart: { key: '' },
      variant: { sku: 'SKU-9' },
      quantity: 1,
    });
    expect(backend.magentoApi.createCart).toHaveBeenCalledTimes(1);
    expect(result.success && result.value.identifier.key).toBe('masked-new-1');
    expect(result.success && result.value.items).toHaveLength(1);
    expect(backend.getActive()).toBe('masked-new-1');
  });

  it('returns InvalidInput for a rejected item instead of throwing', async () => {
    const backend = guestBackend();
    backend.magentoApi.addItemToCart.mockRejectedValueOnce(apiError(400, 'The requested qty is not available'));
    const result = await backend.capability.add({
      cart: { key: GUEST_KEY },
      variant: { sku: 'SKU-1' },
      quantity: 1000,
    });
    expect(result).toMatchObject({
      success: false,
      error: { type: 'InvalidInput', error: 'The requested qty is not available' },
    });
  });

  it('returns Generic for a server failure instead of throwing', async () => {
    const backend = guestBackend();
    backend.magentoApi.addItemToCart.mockRejectedValueOnce(apiError(500));
    const result = await backend.capability.add({
      cart: { key: GUEST_KEY },
      variant: { sku: 'SKU-1' },
      quantity: 1,
    });
    expect(result).toMatchObject({ success: false, error: { type: 'Generic' } });
  });
});

describe('MagentoCartCapability.remove / changeQuantity', () => {
  it('releases a cart left empty from the session', async () => {
    const backend = guestBackend([item(1, 'SKU-1')]);
    const result = await backend.capability.remove({
      cart: { key: GUEST_KEY },
      item: { key: '1' },
    });
    expect(result.success && result.value.items).toHaveLength(0);
    expect(backend.getActive()).toBeNull();
  });

  it('keeps a cart that still has items active', async () => {
    const backend = guestBackend([item(1, 'SKU-1'), item(2, 'SKU-2')]);
    await backend.capability.remove({ cart: { key: GUEST_KEY }, item: { key: '1' } });
    expect(backend.getActive()).toBe(GUEST_KEY);
  });

  it('rejects a non-numeric item key', async () => {
    const backend = guestBackend();
    const result = await backend.capability.changeQuantity({
      cart: { key: GUEST_KEY },
      item: { key: 'abc' },
      quantity: 2,
    });
    expect(result).toMatchObject({ success: false, error: { type: 'InvalidInput' } });
    expect(backend.magentoApi.updateCartItem).not.toHaveBeenCalled();
  });

  it('changes the quantity and returns the recalculated cart', async () => {
    const backend = guestBackend([item(1, 'SKU-1')]);
    const result = await backend.capability.changeQuantity({
      cart: { key: GUEST_KEY },
      item: { key: '1' },
      quantity: 3,
    });
    expect(result.success && result.value.items[0].quantity).toBe(3);
    expect(backend.getActive()).toBe(GUEST_KEY);
  });

  it('maps a missing item to NotFound', async () => {
    const backend = guestBackend([item(1, 'SKU-1')]);
    const result = await backend.capability.changeQuantity({
      cart: { key: GUEST_KEY },
      item: { key: '99' },
      quantity: 3,
    });
    expect(result).toMatchObject({ success: false, error: { type: 'NotFound' } });
  });
});

describe('MagentoCartCapability.changeCurrency', () => {
  it('returns the cart when the currency is already the cart currency', async () => {
    const { capability } = guestBackend();
    const result = await capability.changeCurrency({
      cart: { key: GUEST_KEY },
      newCurrency: 'EUR',
    });
    expect(result.success && result.value.identifier.key).toBe(GUEST_KEY);
  });

  it('rejects another currency as invalid input', async () => {
    const { capability } = guestBackend();
    const result = await capability.changeCurrency({
      cart: { key: GUEST_KEY },
      newCurrency: 'USD',
    });
    expect(result).toMatchObject({ success: false, error: { type: 'InvalidInput' } });
  });
});

describe('MagentoCartCapability name and company', () => {
  it('persists a rename in the session and surfaces it on later reads', async () => {
    const { capability } = guestBackend();
    const renamed = await capability.renameCart({ cart: { key: GUEST_KEY }, newName: 'Office' });
    expect(renamed.success && renamed.value.name).toBe('Office');

    const read = await capability.getById({ cart: { key: GUEST_KEY } });
    expect(read.success && read.value.name).toBe('Office');
  });

  it('returns NotFound when renaming an unknown cart', async () => {
    const { capability } = guestBackend();
    const result = await capability.renameCart({ cart: { key: 'nope' }, newName: 'x' });
    expect(result).toMatchObject({ success: false, error: { type: 'NotFound' } });
  });

  it('honours the name and company given to createCart', async () => {
    const { capability } = createBackend();
    const result = await capability.createCart({
      name: 'Project A',
      company: { taxIdentifier: 'DK123' },
    });
    expect(result.success && result.value.name).toBe('Project A');
    expect(result.success && result.value.company).toEqual({ taxIdentifier: 'DK123' });
  });
});

describe('MagentoCartCapability.listCarts', () => {
  it('returns an empty page when there is no active cart', async () => {
    const { capability } = createBackend();
    const result = await capability.listCarts(LIST_QUERY);
    expect(result).toMatchObject({
      success: true,
      value: { items: [], totalCount: 0, totalPages: 0, pageNumber: 1, pageSize: 20 },
    });
  });

  it('lists the active cart', async () => {
    const { capability } = guestBackend();
    const result = await capability.listCarts(LIST_QUERY);
    expect(result).toMatchObject({
      success: true,
      value: { totalCount: 1, totalPages: 1, items: [{ identifier: { key: GUEST_KEY }, numItems: 1 }] },
    });
  });

  it('returns no items past the first page', async () => {
    const { capability } = guestBackend();
    const result = await capability.listCarts({
      search: { paginationOptions: { pageNumber: 2, pageSize: 20 } },
    });
    expect(result).toMatchObject({
      success: true,
      value: { items: [], totalCount: 1, totalPages: 1, pageNumber: 2 },
    });
  });

  it('filters by the company the cart was created for', async () => {
    const backend = createBackend();
    await backend.capability.createCart({ company: { taxIdentifier: 'DK123' } });

    const personal = await backend.capability.listCarts(LIST_QUERY);
    expect(personal.success && personal.value.totalCount).toBe(0);

    const other = await backend.capability.listCarts({
      search: { ...LIST_QUERY.search, company: { taxIdentifier: 'SE999' } },
    });
    expect(other.success && other.value.totalCount).toBe(0);

    const own = await backend.capability.listCarts({
      search: { ...LIST_QUERY.search, company: { taxIdentifier: 'DK123' } },
    });
    expect(own.success && own.value.totalCount).toBe(1);
    expect(own.success && own.value.items[0].company).toEqual({ taxIdentifier: 'DK123' });
  });

  it("resolves a signed-in customer's active quote when the session has none", async () => {
    const backend = createBackend({ customerToken: 'customer-token' });
    backend.quotes.set('', { id: 77, items: [item(1, 'SKU-1')], customer: { id: 5 } });
    const result = await backend.capability.listCarts(LIST_QUERY);
    expect(result).toMatchObject({
      success: true,
      value: { totalCount: 1, items: [{ identifier: { key: '77' } }] },
    });
    expect(backend.getActive()).toBe('77');
  });
});

describe('MagentoCartCapability.deleteCart', () => {
  it('empties the cart and clears the active marker when it is the active cart', async () => {
    const backend = guestBackend([item(1, 'SKU-1'), item(2, 'SKU-2')]);
    await backend.capability.renameCart({ cart: { key: GUEST_KEY }, newName: 'Old' });

    const result = await backend.capability.deleteCart({ cart: { key: GUEST_KEY } });

    expect(result.success).toBe(true);
    expect(backend.quotes.get(GUEST_KEY)?.items).toHaveLength(0);
    expect(backend.getActive()).toBeNull();
    expect(backend.session.size).toBe(0);
  });

  it('keeps the active marker when deleting another cart', async () => {
    const backend = guestBackend();
    backend.quotes.set('other', { id: 43, items: [item(5, 'SKU-5')], customer: {} });

    const result = await backend.capability.deleteCart({ cart: { key: 'other' } });

    expect(result.success).toBe(true);
    expect(backend.getActive()).toBe(GUEST_KEY);
    expect(backend.quotes.get('other')?.items).toHaveLength(0);
    expect(backend.quotes.get(GUEST_KEY)?.items).toHaveLength(1);
  });

  it("does not empty a customer's quote when asked for a different key", async () => {
    const backend = createBackend({ customerToken: 'customer-token' });
    const customerQuote: MagentoCart = { id: 77, items: [item(1, 'SKU-1')], customer: { id: 5 } };
    // carts/mine answers for any key
    backend.magentoApi.getCart.mockImplementation(async () => structuredClone(customerQuote));

    const result = await backend.capability.deleteCart({ cart: { key: 'stale-guest-key' } });

    expect(result.success).toBe(true);
    expect(backend.magentoApi.removeCartItem).not.toHaveBeenCalled();
  });

  it('succeeds for a cart Magento no longer knows', async () => {
    const backend = guestBackend();
    const result = await backend.capability.deleteCart({ cart: { key: 'gone' } });
    expect(result.success).toBe(true);
  });

  it('returns a typed error when Magento fails', async () => {
    const backend = guestBackend();
    backend.magentoApi.getCart.mockRejectedValueOnce(apiError(500));
    const result = await backend.capability.deleteCart({ cart: { key: GUEST_KEY } });
    expect(result).toMatchObject({ success: false, error: { type: 'Generic' } });
  });
});

describe('MagentoCartCapability coupons', () => {
  it('returns a typed error when Magento rejects the coupon', async () => {
    const backend = guestBackend();
    backend.magentoApi.applyCoupon.mockRejectedValueOnce(apiError(404, "The coupon code isn't valid"));
    const result = await backend.capability.applyCouponCode({
      cart: { key: GUEST_KEY },
      couponCode: 'NOPE',
    });
    expect(result.success).toBe(false);
  });

  it('only removes the coupon when it is the applied one', async () => {
    const backend = guestBackend();
    backend.totals.set(GUEST_KEY, { quote_currency_code: 'EUR' });
    backend.quotes.set(GUEST_KEY, {
      ...(backend.quotes.get(GUEST_KEY) ?? { id: 42, items: [], customer: {} }),
      coupon_code: 'SUMMER',
    });

    await backend.capability.removeCouponCode({ cart: { key: GUEST_KEY }, couponCode: 'WINTER' });
    expect(backend.magentoApi.removeCoupon).not.toHaveBeenCalled();

    await backend.capability.removeCouponCode({ cart: { key: GUEST_KEY }, couponCode: 'summer' });
    expect(backend.magentoApi.removeCoupon).toHaveBeenCalledWith(GUEST_KEY);
  });
});

describe('MagentoCartFactory', () => {
  const factory = new MagentoCartFactory(
    CartSchema,
    CartIdentifierSchema,
    CartPaginatedSearchResultSchema,
  );
  const context = createInitialRequestContext();

  it('keys guest and customer quotes the same way in parseCart and parseCartIdentifier', () => {
    const guest: MagentoCartData = { id: 42, items: [], customer: {}, _requestedId: GUEST_KEY };
    const customer: MagentoCartData = { id: 77, items: [], customer: { id: 5 }, _requestedId: GUEST_KEY };

    expect(factory.parseCart(context, guest).identifier.key).toBe(GUEST_KEY);
    expect(factory.parseCartIdentifier(context, guest).key).toBe(GUEST_KEY);
    expect(factory.parseCart(context, customer).identifier.key).toBe('77');
    expect(factory.parseCartIdentifier(context, customer).key).toBe('77');
  });

  it('maps an applied coupon to a coupon promotion with the discount', () => {
    const cart = factory.parseCart(context, {
      id: 1,
      items: [],
      customer: {},
      quote_currency_code: 'EUR',
      coupon_code: 'SUMMER10',
      discount_amount: -5,
      total_segments: [{ code: 'discount', title: 'Discount (SUMMER10)', value: -5 }],
    });
    expect(cart.appliedPromotions).toEqual([
      {
        code: 'SUMMER10',
        isCouponCode: true,
        name: 'SUMMER10',
        description: 'Discount (SUMMER10)',
        amount: { value: 5, currency: 'EUR' },
      },
    ]);
  });

  it('maps a discount without a coupon to an automatic promotion', () => {
    const cart = factory.parseCart(context, {
      id: 1,
      items: [],
      customer: {},
      quote_currency_code: 'EUR',
      total_segments: [{ code: 'discount', title: 'Discount (Spring sale)', value: -3 }],
    });
    expect(cart.appliedPromotions).toEqual([
      {
        code: '',
        isCouponCode: false,
        name: 'Discount (Spring sale)',
        description: '',
        amount: { value: 3, currency: 'EUR' },
      },
    ]);
  });

  it('reports no promotions without a discount', () => {
    const cart = factory.parseCart(context, { id: 1, items: [], customer: {} });
    expect(cart.appliedPromotions).toEqual([]);
  });

  it('sums fee / surcharge segments into totalSurcharge', () => {
    const cart = factory.parseCart(context, {
      id: 1,
      items: [],
      customer: {},
      quote_currency_code: 'EUR',
      total_segments: [
        { code: 'subtotal', value: 100 },
        { code: 'payment_fee', value: 2.5 },
        { code: 'surcharge', value: 1 },
      ],
    });
    expect(cart.price.totalSurcharge).toEqual({ value: 3.5, currency: 'EUR' });
  });

  it('uses the parent product key from extension attributes and keeps the variant sku', () => {
    const cart = factory.parseCart(context, {
      id: 1,
      customer: {},
      quote_currency_code: 'EUR',
      items: [
        {
          ...item(1, 'SHIRT-RED-M'),
          product_type: 'configurable',
          extension_attributes: { parent_sku: 'SHIRT' },
        },
        item(2, 'MUG'),
      ],
    });
    expect(cart.items[0].product.key).toBe('SHIRT');
    expect(cart.items[0].variant.sku).toBe('SHIRT-RED-M');
    expect(cart.items[1].product.key).toBe('MUG');
  });

  it('reads the currency from the cart currency block', () => {
    const cart = factory.parseCart(context, {
      id: 1,
      items: [],
      customer: {},
      currency: { quote_currency_code: 'DKK' },
    });
    expect(cart.price.grandTotal.currency).toBe('DKK');
  });
});
