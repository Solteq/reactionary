import {
  ProductAssociationSchema,
  ProductAssociationsCapability,
  ProductAssociationsGetAccessoriesQuerySchema,
  ProductAssociationsGetReplacementsQuerySchema,
  ProductAssociationsGetSparepartsQuerySchema,
  Reactionary,
  success,
  type Cache,
  type ProductAssociationsFactory,
  type ProductAssociationsFactoryOutput,
  type ProductAssociationsFactoryWithOutput,
  type ProductAssociationsGetAccessoriesQuery,
  type ProductAssociationsGetReplacementsQuery,
  type ProductAssociationsGetSparepartsQuery,
  type ProductIdentifier,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import createDebug from 'debug';
import * as z from 'zod';
import type { MagentoClient } from '../core/client.js';
import type { MagentoProductAssociationsFactory } from '../factories/product-associations/product-associations.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type {
  MagentoProduct,
  MagentoProductLinkType,
} from '../schema/magento.types.js';
import {
  fetchProductsBySkus,
  handleMagentoLookupError,
  requireProductSku,
} from '../utils/magento-product-lookup.js';

const debug = createDebug('reactionary:magento:product-associations');

/**
 * Maps the reactionary association types onto Magento's native product links.
 * Each mapping is an extension point so projects can re-wire them.
 */
export class MagentoProductAssociationsCapability<
  TFactory extends ProductAssociationsFactory = MagentoProductAssociationsFactory,
> extends ProductAssociationsCapability<ProductAssociationsFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: ProductAssociationsFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: ProductAssociationsFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  protected getAccessoriesLinkType(): MagentoProductLinkType {
    return 'related';
  }

  protected getSparepartsLinkType(): MagentoProductLinkType {
    return 'crosssell';
  }

  protected getReplacementsLinkType(): MagentoProductLinkType {
    return 'upsell';
  }

  /**
   * Loads the enabled, catalog-visible products linked to `forProduct`.
   * Throws when the product cannot be resolved or Magento fails; the public
   * methods turn that into a typed error.
   */
  protected async fetchAssociatedProductsFor(
    forProduct: ProductIdentifier,
    linkType: MagentoProductLinkType,
    maxNumberOfAssociations: number,
  ): Promise<MagentoProduct[]> {
    const sku = await requireProductSku(this.magentoApi, forProduct.key);
    const links = await this.magentoApi.getProductLinks(sku, linkType);
    const linkedSkus = [...links]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((link) => link.linked_product_sku)
      // Over-fetch so that disabled or hidden links do not leave the result
      // short; the visible ones are trimmed to the requested size below.
      .slice(0, Math.max(maxNumberOfAssociations * 3, 20));

    const products = await fetchProductsBySkus(this.magentoApi, linkedSkus);
    debug('%s %s links resolved to %d visible products', sku, linkType, products.length);
    return products.slice(0, maxNumberOfAssociations);
  }

  protected toAssociations(
    forProduct: ProductIdentifier,
    associationType: string,
    products: MagentoProduct[],
  ): ProductAssociationsFactoryOutput<TFactory>[] {
    return products.map((product) =>
      this.factory.parseAssociation(this.context, {
        product,
        identifier: {
          key: `${forProduct.key}-${associationType}-${product.sku}`,
        },
      }),
    );
  }

  @Reactionary({
    inputSchema: ProductAssociationsGetAccessoriesQuerySchema,
    outputSchema: z.array(ProductAssociationSchema),
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async getAccessories(
    query: ProductAssociationsGetAccessoriesQuery,
  ): Promise<Result<ProductAssociationsFactoryOutput<TFactory>[]>> {
    try {
      const products = await this.fetchAssociatedProductsFor(
        query.forProduct,
        this.getAccessoriesLinkType(),
        query.numberOfAccessories,
      );
      return success(this.toAssociations(query.forProduct, 'accessory', products));
    } catch (err) {
      return handleMagentoLookupError('load accessories', err, query.forProduct);
    }
  }

  @Reactionary({
    inputSchema: ProductAssociationsGetSparepartsQuerySchema,
    outputSchema: z.array(ProductAssociationSchema),
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async getSpareparts(
    query: ProductAssociationsGetSparepartsQuery,
  ): Promise<Result<ProductAssociationsFactoryOutput<TFactory>[]>> {
    try {
      const products = await this.fetchAssociatedProductsFor(
        query.forProduct,
        this.getSparepartsLinkType(),
        query.numberOfSpareparts,
      );
      return success(this.toAssociations(query.forProduct, 'sparepart', products));
    } catch (err) {
      return handleMagentoLookupError('load spare parts', err, query.forProduct);
    }
  }

  @Reactionary({
    inputSchema: ProductAssociationsGetReplacementsQuerySchema,
    outputSchema: z.array(ProductAssociationSchema),
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async getReplacements(
    query: ProductAssociationsGetReplacementsQuery,
  ): Promise<Result<ProductAssociationsFactoryOutput<TFactory>[]>> {
    try {
      const products = await this.fetchAssociatedProductsFor(
        query.forProduct,
        this.getReplacementsLinkType(),
        query.numberOfReplacements,
      );
      return success(this.toAssociations(query.forProduct, 'replacement', products));
    } catch (err) {
      return handleMagentoLookupError('load replacements', err, query.forProduct);
    }
  }
}
