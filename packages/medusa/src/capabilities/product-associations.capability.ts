import type {
  Cache,
  ProductAssociationsFactory,
  ProductAssociationsFactoryOutput,
  ProductAssociationsFactoryWithOutput,
  ProductAssociationsGetAccessoriesQuery,
  ProductAssociationsGetReplacementsQuery,
  ProductAssociationsGetSparepartsQuery,
  ProductIdentifier,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  ProductAssociationsCapability,
  Reactionary,
  success
} from '@reactionary/core';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaProductAssociationsFactory } from '../factories/product-associations/product-associations.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

export class MedusaProductAssociationsCapability<
  TFactory extends ProductAssociationsFactory = MedusaProductAssociationsFactory,
> extends ProductAssociationsCapability<ProductAssociationsFactoryOutput<TFactory>> {
  protected config: MedusaConfiguration;
  protected medusa: MedusaAPI;
  protected factory: ProductAssociationsFactoryWithOutput<TFactory>;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    medusa: MedusaAPI,
    factory: ProductAssociationsFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.medusa = medusa;
    this.factory = factory;
  }

  protected async fetchAssociatedProductsFor(productKey: ProductIdentifier, maxNumberOfAssociations: number, attributeName: string) {
    const client = await this.medusa.getClient();

    // First, get the main product to check for associations in metadata
    const productResponse = await client.store.product.list({
      external_id: productKey.key,
      limit: 1,
      offset: 0,
      fields: 'metadata.*,external_id',
    })

    let product;
    if (!productResponse.products || productResponse.products.length === 0)
      return [];
    else
      product = productResponse.products[0];

    if (!product) {
      return [];
    }

    // Look for associations in metadata
    const associationsMetadata = (product.metadata?.[attributeName] as string || '').split(';');
    if (!associationsMetadata || associationsMetadata.length === 0 || associationsMetadata[0] === '') {
      return [];
    }

    const associatedProductIds: string[] = associationsMetadata.slice(0, maxNumberOfAssociations);


    const associatedProductsResponse = await client.store.product.list({
      external_id: associatedProductIds,
      fields: '+metadata.*,+external_id',
      offset: 0,
      limit: maxNumberOfAssociations,
    });

    return associatedProductsResponse.products || [];
  }


  @Reactionary({
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false
  })
  public override async getAccessories(
    query: ProductAssociationsGetAccessoriesQuery
  ): Promise<Result<ProductAssociationsFactoryOutput<TFactory>[]>> {
    const associatedProducts = await this.fetchAssociatedProductsFor(query.forProduct, query.numberOfAccessories || 4, 'reactionaryaccessories');

    const result = associatedProducts.map(product => this.factory.parseAssociation(this.context, {
      product,
      identifier: {
        key: `${query.forProduct.key}-accessory-${product.external_id}`
      },
    }));

    return success(result);
  }

  @Reactionary({
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false
  })
  public override async getSpareparts(
    query: ProductAssociationsGetSparepartsQuery
  ): Promise<Result<ProductAssociationsFactoryOutput<TFactory>[]>> {
    const associatedProducts = await this.fetchAssociatedProductsFor(query.forProduct, query.numberOfSpareparts || 4, 'reactionaryspareparts');

    const result = associatedProducts.map(product => this.factory.parseAssociation(this.context, {
      product,
      identifier: {
        key: `${query.forProduct.key}-sparepart-${product.external_id}`
      },
    }));

    return success(result);
  }

  @Reactionary({
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false
  })
  public override async getReplacements(
    query: ProductAssociationsGetReplacementsQuery
  ): Promise<Result<ProductAssociationsFactoryOutput<TFactory>[]>> {
    const associatedProducts = await this.fetchAssociatedProductsFor(query.forProduct, query.numberOfReplacements || 4, 'reactionaryreplacements');

    const result = associatedProducts.map(product => this.factory.parseAssociation(this.context, {
      product,
      identifier: {
        key: `${query.forProduct.key}-replacement-${product.external_id}`
      },
    }));

    return success(result);
  }

}
