import type { RequestContext } from '@reactionary/core';
import {
  InventorySchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagentoInventoryCapability } from '../capabilities/inventory.capability.js';
import { MagentoClient } from '../core/client.js';
import {
  MagentoInventoryFactory,
  resolveMagentoInventoryStatus,
} from '../factories/inventory/inventory.factory.js';
import { MagentoConfigurationSchema } from '../schema/configuration.schema.js';

const config = MagentoConfigurationSchema.parse({
  adminApiKey: 'admin-token',
  baseUrl: 'https://shop.example.com',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const notFound = () => json({ message: 'The requested entity does not exist.' }, 404);

type Router = (url: URL) => Response;

let context: RequestContext;
let capability: MagentoInventoryCapability;
let fetchMock: ReturnType<typeof vi.fn>;

function route(router: Router) {
  fetchMock.mockImplementation(async (input: string) => router(new URL(input)));
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  context = createInitialRequestContext();
  capability = new MagentoInventoryCapability(
    config,
    new NoOpCache(),
    context,
    new MagentoClient(config, context),
    new MagentoInventoryFactory(InventorySchema),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveMagentoInventoryStatus', () => {
  it('maps stock flags and backorders onto core statuses', () => {
    expect(resolveMagentoInventoryStatus({ isInStock: true, quantity: 3 })).toBe('inStock');
    expect(resolveMagentoInventoryStatus({ isInStock: false, quantity: 3 })).toBe('outOfStock');
    expect(
      resolveMagentoInventoryStatus({ isInStock: true, quantity: 0, backorders: 1 }),
    ).toBe('onBackOrder');
    expect(
      resolveMagentoInventoryStatus({ isInStock: true, quantity: 0, backorders: 0 }),
    ).toBe('outOfStock');
    expect(
      resolveMagentoInventoryStatus({ isInStock: true, quantity: 0, manageStock: false }),
    ).toBe('inStock');
  });
});

describe('MagentoInventoryFactory', () => {
  it('keeps the status the capability derived', () => {
    const inventory = new MagentoInventoryFactory(InventorySchema).parseInventory(
      context,
      { sku: 'SKU-1', fulfillmentCenterKey: 'default', quantity: 0, status: 'onBackOrder' },
    );
    expect(inventory.status).toBe('onBackOrder');
  });

  it('rejects malformed input', () => {
    expect(() =>
      new MagentoInventoryFactory(InventorySchema).parseInventory(context, { sku: 1 }),
    ).toThrow();
  });
});

describe('MagentoInventoryCapability', () => {
  it('reads the MSI source item of the requested source', async () => {
    route((url) => {
      if (url.pathname.endsWith('/V1/inventory/source-items')) {
        expect(url.searchParams.get('searchCriteria[filterGroups][1][filters][0][value]')).toBe('warehouse-1');
        return json({
          items: [{ sku: 'SKU-1', source_code: 'warehouse-1', quantity: 7, status: 1 }],
          total_count: 1,
        });
      }
      return notFound();
    });

    const result = await capability.getBySKU({
      variant: { sku: 'SKU-1' },
      fulfilmentCenter: { key: 'warehouse-1' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.quantity).toBe(7);
      expect(result.value.status).toBe('inStock');
      expect(result.value.identifier.fulfillmentCenter.key).toBe('warehouse-1');
    }
  });

  it('reports a backorderable source item without stock as onBackOrder', async () => {
    route((url) => {
      if (url.pathname.endsWith('/V1/inventory/source-items')) {
        return json({
          items: [{ sku: 'SKU-1', source_code: 'warehouse-1', quantity: 0, status: 1 }],
          total_count: 1,
        });
      }
      if (url.pathname.endsWith('/V1/stockItems/SKU-1')) {
        return json({ qty: 0, is_in_stock: true, backorders: 1 });
      }
      return notFound();
    });

    const result = await capability.getBySKU({
      variant: { sku: 'SKU-1' },
      fulfilmentCenter: { key: 'warehouse-1' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe('onBackOrder');
    }
  });

  it('returns NotFound for a source Magento does not know', async () => {
    route((url) => {
      if (url.pathname.endsWith('/V1/inventory/source-items')) {
        return json({ items: [], total_count: 0 });
      }
      return notFound();
    });

    const result = await capability.getBySKU({
      variant: { sku: 'SKU-1' },
      fulfilmentCenter: { key: 'nowhere' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
    // Never falls back to the legacy single-stock endpoint for another source.
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/V1/stockStatuses/'))).toBe(false);
  });

  it('reports a known source without the SKU as out of stock', async () => {
    route((url) => {
      if (url.pathname.endsWith('/V1/inventory/source-items')) {
        return json({ items: [], total_count: 0 });
      }
      if (url.pathname.endsWith('/V1/inventory/sources/store-2')) {
        return json({ source_code: 'store-2', enabled: true });
      }
      return notFound();
    });

    const result = await capability.getBySKU({
      variant: { sku: 'SKU-1' },
      fulfilmentCenter: { key: 'store-2' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.quantity).toBe(0);
      expect(result.value.status).toBe('outOfStock');
      expect(result.value.identifier.fulfillmentCenter.key).toBe('store-2');
    }
  });

  it('falls back to legacy stock for the default source when MSI is absent', async () => {
    route((url) => {
      if (url.pathname.endsWith('/V1/stockStatuses/SKU-1')) {
        return json({
          qty: 0,
          stock_status: 1,
          stock_item: { qty: 0, is_in_stock: true, backorders: 2 },
        });
      }
      return notFound();
    });

    const result = await capability.getBySKU({
      variant: { sku: 'SKU-1' },
      fulfilmentCenter: { key: 'default' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe('onBackOrder');
      expect(result.value.identifier.fulfillmentCenter.key).toBe('default');
    }
  });

  it('returns NotFound for an unknown SKU', async () => {
    route(() => notFound());

    const result = await capability.getBySKU({
      variant: { sku: 'MISSING' },
      fulfilmentCenter: { key: 'default' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('NotFound');
    }
  });

  it('returns a Generic error instead of an empty inventory when Magento fails', async () => {
    route(() => json({ message: 'Internal error' }, 500));

    const result = await capability.getBySKU({
      variant: { sku: 'SKU-1' },
      fulfilmentCenter: { key: 'default' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Generic');
    }
  });
});
