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
import {
  MagentoCatalogApi,
  MagentoVisibility,
  buildSearchCriteria,
  isProductEnabled,
  storefrontProductFilterGroups,
  type MagentoFilterGroup,
} from '../core/catalog.api.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoProductFactory } from '../factories/product/product.factory.js';
import type { MagentoProductDetails } from '../schema/catalog.types.js';
import type { MagentoProduct } from '../schema/magento.types.js';
import { getProductKey } from '../utils/magento-product.js';
import { handleMagentoProviderError } from '../utils/magento-errors.js';

const debug = createDebug('reactionary:magento:product');

/** Visibilities that have a product detail page: Catalog, Search, and Catalog+Search. */
const PDP_VISIBILITIES = [
  MagentoVisibility.Catalog,
  MagentoVisibility.Search,
  MagentoVisibility.CatalogSearch,
];

/**
 * Products are keyed by `getProductKey`: the `external_id` attribute, falling
 * back to the Magento entity id. Lookups by key accept both and only match the
 * product whose own key equals the requested one.
 */
export class MagentoProductCapability<
  TFactory extends ProductFactory = MagentoProductFactory,
> extends ProductCapability<ProductFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: ProductFactoryWithOutput<TFactory>;
  protected catalog: MagentoCatalogApi;

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
    this.catalog = new MagentoCatalogApi(magentoApi, cache, config, context);
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
      debug(`Fetching product by key: ${key}`);
    }

    try {
      const keyFilters: MagentoFilterGroup = [
        { field: 'external_id', value: key, conditionType: 'eq' },
      ];
      if (/^\d+$/.test(key)) {
        keyFilters.push({ field: 'entity_id', value: key, conditionType: 'eq' });
      }

      const candidates = await this.searchStorefrontProducts([keyFilters], 2);
      const product = candidates.find((candidate) => getProductKey(candidate) === key);
      if (!product) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.identifier });
      }

      return success(this.factory.parseProduct(this.context, await this.loadProductDetails(product)));
    } catch (e) {
      return handleMagentoProviderError('get product by id', e, payload.identifier);
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
      const [product] = await this.searchStorefrontProducts(
        [[{ field: 'url_key', value: payload.slug, conditionType: 'eq' }]],
        1,
      );

      if (!product) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload });
      }

      return success(this.factory.parseProduct(this.context, await this.loadProductDetails(product)));
    } catch (e) {
      return handleMagentoProviderError('get product by slug', e, payload);
    }
  }

  /**
   * Looks the SKU up directly. Disabled products are NotFound; visibility is
   * deliberately not checked, since cart lines reference configurable
   * children, which are "Not Visible Individually". A configurable parent SKU
   * resolves to the parent with its first child as main variant.
   */
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

    try {
      const product = await this.magentoApi.getProductBySKU(sku);
      if (!isProductEnabled(product)) {
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.variant });
      }

      return success(
        this.factory.parseProduct(this.context, await this.loadProductDetails(product, sku)),
      );
    } catch (e) {
      return handleMagentoProviderError('get product by sku', e, payload.variant);
    }
  }

  /** Searches enabled products that have a product page, ANDed with `groups`. */
  protected async searchStorefrontProducts(
    groups: MagentoFilterGroup[],
    pageSize: number,
  ): Promise<MagentoProduct[]> {
    const params = buildSearchCriteria(
      [...groups, ...storefrontProductFilterGroups(PDP_VISIBILITIES)],
      { pageSize, currentPage: 1 },
    );
    const result = await this.magentoApi.searchProducts(params);
    return result.items ?? [];
  }

  /**
   * Fetches what the REST product payload lacks: the enabled children and
   * configurable attributes of a configurable product, the attribute metadata
   * (labels, storefront visibility) and the keys of the product's categories.
   */
  protected async loadProductDetails(
    product: MagentoProduct,
    preferredSku?: string,
  ): Promise<MagentoProductDetails> {
    // Links to the store root (or the global root above it) are not navigable categories.
    const categoryIds = (product.extension_attributes?.category_links ?? [])
      .map((link) => String(link.category_id))
      .filter((id) => id !== this.config.rootCategoryId && id !== '1');
    const isConfigurable = product.type_id === 'configurable';

    const [attributes, categoryKeys, children, configurableOptions] = await Promise.all([
      this.catalog.getAttributeCatalog(product),
      this.catalog.resolveCategoryKeys(categoryIds),
      isConfigurable ? this.magentoApi.getConfigurableChildren(product.sku) : Promise.resolve([]),
      isConfigurable ? this.magentoApi.getConfigurableOptions(product.sku) : Promise.resolve([]),
    ]);

    return {
      product,
      attributes,
      categoryKeys,
      children: children.filter((child) => isProductEnabled(child)),
      configurableOptions,
      preferredSku,
    };
  }
}
