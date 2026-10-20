import type { RequestContext } from '@reactionary/core';
import { NoOpCache, OrderSchema, createInitialRequestContext } from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoOrderCapability } from '../capabilities/order.capability.js';
import { MagentoClient } from '../core/client.js';
import { MagentoApiError } from '../core/errors.js';
import { rememberMagentoOrderPlacedInSession } from '../core/order.api.js';
import { MagentoOrderFactory } from '../factories/order/order.factory.js';
import { MagentoConfigurationSchema } from '../schema/configuration.schema.js';
import type { MagentoSalesOrder } from '../schema/magento.types.js';

const config = MagentoConfigurationSchema.parse({
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  defaultCurrency: 'EUR',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
});

const SAMPLE_RAW_ORDER: MagentoSalesOrder = {
  entity_id: 42,
  increment_id: '000000042',
  customer_id: 7,
  customer_is_guest: 0,
  customer_email: 'shopper@example.com',
  status: 'processing',
  state: 'processing',
  created_at: '2026-08-20 10:00:00',
  order_currency_code: 'EUR',
  grand_total: 100,
  subtotal: 90,
  shipping_amount: 10,
  discount_amount: 0,
  tax_amount: 0,
  items: [{ item_id: 1, sku: 'SKU-1', qty_ordered: 1, price: 90, row_total: 90 }],
  billing_address: {
    firstname: 'Jane',
    lastname: 'Doe',
    street: ['Main St 1'],
    city: 'Tallinn',
    postcode: '10111',
    country_id: 'EE',
    telephone: '5551234',
    email: 'shopper@example.com',
  },
  payment: { method: 'checkmo', amount_ordered: 100 },
};

const GUEST_ORDER: MagentoSalesOrder = {
  ...SAMPLE_RAW_ORDER,
  customer_id: undefined,
  customer_is_guest: 1,
};

describe('MagentoOrderCapability', () => {
  let reqCtx: RequestContext;
  let client: MagentoClient;
  let capability: MagentoOrderCapability;

  beforeEach(() => {
    // Every Magento call is stubbed per test; a real request is a test bug.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unexpected network call')));
    reqCtx = createInitialRequestContext();
    client = new MagentoClient(config, reqCtx);
    capability = new MagentoOrderCapability(
      config,
      new NoOpCache(),
      reqCtx,
      client,
      new MagentoOrderFactory(OrderSchema),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the order to the customer who placed it', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
    const getOrderById = vi.spyOn(client, 'getOrderById').mockResolvedValue(SAMPLE_RAW_ORDER);

    const result = await capability.getById({ order: { key: '42' } });

    expect(getOrderById).toHaveBeenCalledWith('42');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.identifier.key).toBe('42');
      expect(result.value.items).toHaveLength(1);
    }
  });

  it("reports another customer's order as NotFound", async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(8);
    vi.spyOn(client, 'getOrderById').mockResolvedValue(SAMPLE_RAW_ORDER);

    const result = await capability.getById({ order: { key: '42' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({ type: 'NotFound', identifier: { key: '42' } });
    }
  });

  it('reports any order as NotFound to a guest without reading it', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(null);
    const getOrderById = vi.spyOn(client, 'getOrderById').mockResolvedValue(SAMPLE_RAW_ORDER);

    const result = await capability.getById({ order: { key: '42' } });

    expect(getOrderById).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('reports a guest order as NotFound to a signed-in customer', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
    vi.spyOn(client, 'getOrderById').mockResolvedValue(GUEST_ORDER);

    const result = await capability.getById({ order: { key: '42' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('lets a guest read back the order placed in the same session', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(null);
    vi.spyOn(client, 'getOrderById').mockResolvedValue(GUEST_ORDER);
    await rememberMagentoOrderPlacedInSession(client, 42);

    const result = await capability.getById({ order: { key: '42' } });

    expect(result.success).toBe(true);
  });

  it('does not let a session-placed order unlock a different order', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(null);
    const getOrderById = vi.spyOn(client, 'getOrderById').mockResolvedValue(GUEST_ORDER);
    await rememberMagentoOrderPlacedInSession(client, 41);

    const result = await capability.getById({ order: { key: '42' } });

    expect(getOrderById).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric order key without calling Magento', async () => {
    const getCustomerId = vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
    const getOrderById = vi.spyOn(client, 'getOrderById').mockResolvedValue(SAMPLE_RAW_ORDER);

    const result = await capability.getById({ order: { key: '42/../1' } });

    expect(getCustomerId).not.toHaveBeenCalled();
    expect(getOrderById).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('returns a NotFound error when Magento has no such order', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
    vi.spyOn(client, 'getOrderById').mockResolvedValue(undefined);

    const result = await capability.getById({ order: { key: '999' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({ type: 'NotFound', identifier: { key: '999' } });
    }
  });

  it('returns a Generic error instead of throwing when Magento fails', async () => {
    vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
    vi.spyOn(client, 'getOrderById').mockRejectedValue(
      new MagentoApiError({ transport: 'rest', status: 500, method: 'GET', url: '/V1/orders/42' }),
    );

    const result = await capability.getById({ order: { key: '42' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Generic');
    }
  });

  describe('B2B company', () => {
    const B2B_ORDER: MagentoSalesOrder = {
      ...SAMPLE_RAW_ORDER,
      extension_attributes: {
        company_order_attributes: { order_id: 42, company_id: 3, company_name: 'ACME' },
      },
    };

    it('identifies the ordering company by its VAT id', async () => {
      vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
      vi.spyOn(client, 'getOrderById').mockResolvedValue(B2B_ORDER);
      const adminRequest = vi
        .spyOn(client, 'adminRequest')
        .mockResolvedValue({ id: 3, company_name: 'ACME', vat_tax_id: 'EE123' });

      const result = await capability.getById({ order: { key: '42' } });

      expect(adminRequest).toHaveBeenCalledWith('GET', '/V1/company/3');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.company?.taxIdentifier).toBe('EE123');
      }
    });

    it('still returns the order when the company cannot be read', async () => {
      vi.spyOn(client, 'getCustomerId').mockResolvedValue(7);
      vi.spyOn(client, 'getOrderById').mockResolvedValue(B2B_ORDER);
      vi.spyOn(client, 'adminRequest').mockRejectedValue(
        new MagentoApiError({ transport: 'rest', status: 403, method: 'GET', url: '/V1/company/3' }),
      );

      const result = await capability.getById({ order: { key: '42' } });

      expect(result.success).toBe(true);
      if (result.success) {
        // Falls back to the company uid (base64 of the entity id).
        expect(result.value.company?.taxIdentifier).toBe('Mw==');
      }
    });
  });
});
