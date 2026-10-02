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
import type { MagentoProduct } from '../schema/magento.types.js';

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

  return `${b}/rest/${storeCode}/V1/products?${params.toString()}`;
}

async function adminSearchProducts(
  config: MagentoConfiguration,
  field: string,
  value: string | number,
  options?: { badRequestAsNoMatch?: boolean },
): Promise<{ items: MagentoProduct[]; total_count?: number }> {
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

  if (res.status === 400 && options?.badRequestAsNoMatch) {
    return { items: [] };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Magento admin search failed: GET ${url} -> ${res.status} ${res.statusText}\n${text}`,
    );
  }

  return (await res.json()) as { items: MagentoProduct[]; total_count?: number };
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

    const product = await this.findProductByKey(key);
    if (!product) {
      return success(this.createEmptyProduct(key));
    }
    return success(this.factory.parseProduct(this.context, product));
  }

  /**
   * Mirrors the precedence `getProductKey()` uses when emitting keys:
   * `external_id`, then the numeric entity id, then the SKU. Stores without an
   * `external_id` attribute answer that filter with a 400, which is treated as
   * no match. Resolves to `undefined` only when every lookup misses; any other
   * failure is thrown.
   */
  protected async findProductByKey(key: string): Promise<MagentoProduct | undefined> {
    if (key.length === 0) {
      return undefined;
    }

    const byExternalId = await adminSearchProducts(this.config, 'external_id', key, {
      badRequestAsNoMatch: true,
    });
    if (byExternalId.items?.[0]) {
      return byExternalId.items[0];
    }

    if (/^\d+$/.test(key)) {
      const byEntityId = await adminSearchProducts(this.config, 'entity_id', key);
      return byEntityId.items?.[0];
    }

    return this.magentoApi.getProductBySKU(key, { allowNotFound: true });
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

    const result = await adminSearchProducts(this.config, 'url_key', payload.slug);
    const product = result.items?.[0];

    if (!product) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    }

    return success(this.factory.parseProduct(this.context, product));
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
