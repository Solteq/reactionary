import type { RequestContext } from '@reactionary/core';
import {
  NoOpCache,
  PriceSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoPriceCapability } from '../capabilities/price.capability.js';
import { MagentoClient, RequestContextTokenStore } from '../core/client.js';
import { MagentoPriceFactory } from '../factories/price/price.factory.js';
import {
  MagentoConfigurationSchema,
  type MagentoConfiguration,
} from '../schema/configuration.schema.js';
import type { MagentoProduct } from '../schema/magento.types.js';

const config = MagentoConfigurationSchema.parse({
  adminApiKey: 'admin-token',
  baseUrl: 'https://shop.example.com',
  allCurrencies: ['EUR', 'SEK'],
  defaultCurrency: 'SEK',
  storeBaseCode: 'default',
});

const NOW = new Date('2026-06-15T12:00:00Z');

function product(overrides: Partial<MagentoProduct> = {}): MagentoProduct {
  return {
    id: 1,
    sku: 'SKU-1',
    name: 'Drill',
    price: 100,
    custom_attributes: [],
    tier_prices: [],
    ...overrides,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('MagentoPriceFactory', () => {
  const factory = new MagentoPriceFactory(PriceSchema);
  const context = createInitialRequestContext();

  it('returns the regular price as list price, never on sale', () => {
    const price = factory.parsePrice(context, {
      product: product({
        custom_attributes: [{ attribute_code: 'special_price', value: '80' }],
      }),
      sku: 'SKU-1',
      mode: 'list',
      currency: 'SEK',
      now: NOW,
    });
    expect(price.unitPrice).toEqual({ value: 100, currency: 'SEK' });
    expect(price.onSale).toBe(false);
  });

  it('applies an active special price and flags it as on sale', () => {
    const price = factory.parsePrice(context, {
      product: product({
        custom_attributes: [
          { attribute_code: 'special_price', value: '80.000000' },
          { attribute_code: 'special_from_date', value: '2026-06-01 00:00:00' },
          { attribute_code: 'special_to_date', value: '2026-06-15 00:00:00' },
        ],
      }),
      sku: 'SKU-1',
      mode: 'customer',
      now: NOW,
    });
    expect(price.unitPrice.value).toBe(80);
    expect(price.onSale).toBe(true);
  });

  it('ignores a special price outside its date range', () => {
    const price = factory.parsePrice(context, {
      product: product({
        custom_attributes: [
          { attribute_code: 'special_price', value: '80' },
          { attribute_code: 'special_to_date', value: '2026-06-14 00:00:00' },
        ],
      }),
      sku: 'SKU-1',
      mode: 'customer',
      now: NOW,
    });
    expect(price.unitPrice.value).toBe(100);
    expect(price.onSale).toBe(false);
  });

  it('only uses the tiers of the customer group and ALL GROUPS', () => {
    const price = factory.parsePrice(context, {
      product: product({
        tier_prices: [
          { customer_group_id: 1, qty: 10, value: 90 },
          { customer_group_id: 32000, qty: 20, value: 85 },
          { customer_group_id: 2, qty: 10, value: 50 },
          {
            customer_group_id: 1,
            qty: 50,
            value: 0,
            extension_attributes: { percentage_value: 25 },
          },
        ],
      }),
      sku: 'SKU-1',
      mode: 'customer',
      customerGroupId: 1,
      now: NOW,
    });
    expect(price.tieredPrices.map((t) => [t.minimumQuantity, t.price.value])).toEqual([
      [10, 90],
      [20, 85],
      [50, 75],
    ]);
  });

  it('uses a quantity-1 group price (B2B shared catalog) as unit price without flagging a sale', () => {
    const price = factory.parsePrice(context, {
      product: product({
        tier_prices: [{ customer_group_id: 4, qty: 1, value: 70 }],
      }),
      sku: 'SKU-1',
      mode: 'customer',
      customerGroupId: 4,
      now: NOW,
    });
    expect(price.unitPrice.value).toBe(70);
    expect(price.onSale).toBe(false);
    expect(price.tieredPrices).toEqual([]);
  });

  it('rejects input that is not a Magento product', () => {
    expect(() => factory.parsePrice(context, { sku: 'SKU-1' })).toThrow();
  });
});

describe('MagentoPriceCapability', () => {
  let context: RequestContext;
  let fetchMock: ReturnType<typeof vi.fn>;
  let catalogProduct: MagentoProduct;
  let me: Record<string, unknown> | undefined;
  let company: Record<string, unknown>;

  function createCapability(cfg: MagentoConfiguration = config) {
    return new MagentoPriceCapability(
      cfg,
      new NoOpCache(),
      context,
      new MagentoClient(cfg, context),
      new MagentoPriceFactory(PriceSchema),
    );
  }

  async function signIn() {
    await new RequestContextTokenStore(context).setItem('customerToken', 'customer-token');
  }

  beforeEach(() => {
    context = createInitialRequestContext();
    catalogProduct = product({
      tier_prices: [
        { customer_group_id: 0, qty: 1, value: 95 },
        { customer_group_id: 5, qty: 1, value: 60 },
      ],
    });
    me = undefined;
    company = { id: 9, vat_tax_id: 'SE123' };
    fetchMock = vi.fn().mockImplementation(async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      if (url.pathname.endsWith('/V1/products/SKU-1')) {
        return json(catalogProduct);
      }
      if (url.pathname.endsWith('/V1/customers/me')) {
        return me ? json(me) : json({ message: 'unauthorized' }, 401);
      }
      if (url.pathname.endsWith('/V1/company/9')) {
        return json(company);
      }
      if (url.pathname.endsWith('/graphql') && String(init?.body).includes('base_currency_code')) {
        return json({ data: { storeConfig: { base_currency_code: 'EUR' } } });
      }
      if (url.pathname.endsWith('/V1/products/BOOM')) {
        return json({ message: 'boom' }, 500);
      }
      return json({ message: 'not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prices an anonymous shopper with the NOT LOGGED IN group in the store currency', async () => {
    const result = await createCapability().getCustomerPrice({ variant: { sku: 'SKU-1' } });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.unitPrice).toEqual({ value: 95, currency: 'SEK' });
    }
  });

  it("prices a signed-in customer with the customer's own group", async () => {
    await signIn();
    me = { id: 3, email: 'a@b.c', group_id: 5 };

    const result = await createCapability().getCustomerPrice({ variant: { sku: 'SKU-1' } });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.unitPrice.value).toBe(60);
    }
  });

  it('keeps the list price undiscounted', async () => {
    const result = await createCapability().getListPrice({ variant: { sku: 'SKU-1' } });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.unitPrice.value).toBe(100);
    }
  });

  it('reads the base currency from the store config when none is configured', async () => {
    const result = await createCapability({ ...config, defaultCurrency: '' }).getListPrice({
      variant: { sku: 'SKU-1' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.unitPrice.currency).toBe('EUR');
    }
  });

  it('returns NotFound for an unknown SKU instead of a placeholder price', async () => {
    const result = await createCapability().getListPrice({ variant: { sku: 'MISSING' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('returns a Generic error when Magento fails', async () => {
    const result = await createCapability().getCustomerPrice({ variant: { sku: 'BOOM' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Generic');
    }
  });

  it('rejects company pricing for an anonymous shopper', async () => {
    const result = await createCapability().getCustomerPrice({
      variant: { sku: 'SKU-1' },
      company: { taxIdentifier: 'SE123' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('InvalidInput');
    }
  });

  it("rejects a company that is not the customer's own", async () => {
    await signIn();
    me = {
      id: 3,
      email: 'a@b.c',
      group_id: 5,
      extension_attributes: { company_attributes: { company_id: 9 } },
    };

    const result = await createCapability().getCustomerPrice({
      variant: { sku: 'SKU-1' },
      company: { taxIdentifier: 'DK999' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('InvalidInput');
    }
  });

  it("prices a company user with the company's group", async () => {
    await signIn();
    me = {
      id: 3,
      email: 'a@b.c',
      group_id: 5,
      extension_attributes: { company_attributes: { company_id: 9 } },
    };

    const result = await createCapability().getCustomerPrice({
      variant: { sku: 'SKU-1' },
      company: { taxIdentifier: 'se123' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.unitPrice.value).toBe(60);
    }
  });
});
