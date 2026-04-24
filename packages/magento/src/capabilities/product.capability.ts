import type {
  Cache,
  NotFoundError,
  ProductFactory,
  ProductFactoryOutput,
  ProductFactoryWithOutput,
  ProductQueryById,
  ProductQueryBySKU,
  ProductQueryBySlug,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  ProductCapability,
  ProductQueryByIdSchema,
  ProductQueryBySKUSchema,
  ProductQueryBySlugSchema,
  ProductSchema,
  Reactionary,
  success,
  error,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoClient } from '../core/client.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoProductFactory } from '../factories/product/product.factory.js';

const debug = createDebug('reactionary:magento:product');

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function buildProductsSearchUrl(
  baseUrl: string,
  storeCode: string,
  field: string,
  value: string | number,
  condition: 'eq' | 'like' = 'eq',
  pageSize = 1,
  currentPage = 1,
): string {
  const b = normalizeBaseUrl(baseUrl);

  const params = new URLSearchParams();
  params.set('searchCriteria[filterGroups][0][filters][0][field]', field);
  params.set('searchCriteria[filterGroups][0][filters][0][value]', String(value));
  params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', condition);
  params.set('searchCriteria[pageSize]', String(pageSize));
  params.set('searchCriteria[currentPage]', String(currentPage));

  return `${b}/${storeCode}/rest/V1/products?${params.toString()}`;
}

async function adminSearchProducts(
  config: MagentoConfiguration,
  field: string,
  value: string | number,
): Promise<{ items: Array<Record<string, unknown>>; total_count?: number }> {
  const token = config.adminApiKey;
  if (!token) {
    throw new Error(
      `Magento admin search requires admin token. Missing config.adminApiKey for field=${field}.`,
    );
  }

  const url = buildProductsSearchUrl(config.baseUrl, config.storeCode, field, value, 'eq', 1, 1);

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Magento admin search failed: GET ${url} -> ${res.status} ${res.statusText}\n${text}`,
    );
  }

  return (await res.json()) as { items: Array<Record<string, unknown>>; total_count?: number };
}

export class MagentoProductCapability<
  TFactory extends ProductFactory = MagentoProductFactory,
> extends ProductCapability<ProductFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: ProductFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: ProductFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: ProductQueryByIdSchema,
    outputSchema: ProductSchema,
  })
  public override async getById(
    payload: ProductQueryById,
  ): Promise<Result<ProductFactoryOutput<TFactory>>> {
    const key = payload.identifier.key;

    if (debug.enabled) {
      debug(`Fetching product by ID/key: ${key}`);
    }

    try {
      if (/^\d+$/.test(key)) {
        const result = await adminSearchProducts(this.config, 'entity_id', Number(key));
        const product = result.items?.[0];
        if (!product) {
          return success(this.createEmptyProduct(key));
        }
        return success(this.factory.parseProduct(this.context, product));
      }

      const product = await this.magentoApi.getProductBySKU(key);
      return success(this.factory.parseProduct(this.context, product));
    } catch (e) {
      if (debug.enabled) {
        debug(`Product with key ${key} not found. Error %O`, e);
      }
      return success(this.createEmptyProduct(key));
    }
  }

  @Reactionary({
    inputSchema: ProductQueryBySlugSchema,
    outputSchema: ProductSchema.nullable(),
  })
  public override async getBySlug(
    payload: ProductQueryBySlug,
  ): Promise<Result<ProductFactoryOutput<TFactory>, NotFoundError>> {
    if (debug.enabled) {
      debug(`Fetching product by slug(url_key): ${payload.slug}`);
    }

    try {
      const result = await adminSearchProducts(this.config, 'url_key', payload.slug);
      const product = result.items?.[0];

      if (!product) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload,
        });
      }

      return success(this.factory.parseProduct(this.context, product));
    } catch (e) {
      if (debug.enabled) {
        debug(`Slug lookup failed for ${payload.slug}. Error %O`, e);
      }
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    }
  }

  @Reactionary({
    inputSchema: ProductQueryBySKUSchema,
    outputSchema: ProductSchema,
  })
  public override async getBySKU(
    payload: ProductQueryBySKU,
  ): Promise<Result<ProductFactoryOutput<TFactory>>> {
    const sku = payload.variant.sku;

    if (debug.enabled) {
      debug(`Fetching product by SKU: ${sku}`);
    }

    const product = await this.magentoApi.getProductBySKU(sku);

    return success(this.factory.parseProduct(this.context, product));
  }
}
