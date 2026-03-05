import {
  type ProductAssociationsFactory,
  type ProductAssociationsFactoryOutput,
  type ProductAssociationsFactoryWithOutput,
  ProductAssociationsProvider,
  Reactionary,
  success,
  error,
} from '@reactionary/core';
import type {
  ProductIdentifier,
  ProductAssociationsGetAccessoriesQuery,
  ProductAssociationsGetSparepartsQuery,
  ProductAssociationsGetReplacementsQuery,
  Result,
  RequestContext,
  Cache,
  NotFoundError,
} from '@reactionary/core';
import type { ProductProjection } from '@commercetools/platform-sdk';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsProductAssociationsFactory } from '../factories/product-associations/product-associations.factory.js';

export class CommercetoolsProductAssociationsProvider<
  TFactory extends ProductAssociationsFactory = CommercetoolsProductAssociationsFactory,
> extends ProductAssociationsProvider<ProductAssociationsFactoryOutput<TFactory>> {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: ProductAssociationsFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: ProductAssociationsFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  protected async fetchAssociatedProductsFor(productKey: ProductIdentifier, maxNumberOfAssociations: number, attributeName: string): Promise<ProductProjection[]> {
      const client = await this.getClient();

      const product = await client
        .productProjections()
        .withKey({ key: productKey.key })
        .get()
        .execute().catch( (e) => {
          if (e.statusCode === 404) {
            return null;
          }
          throw e;
        })

        if (!product || !product.body) {
          return [];
        }

        // Look for associations in custom fields or references
        // In Commercetools, associations can be stored as custom fields or product references
        const associatedProducts: ProductIdentifier[] = [];
        const associationsAttr = product.body.attributes.find(attr => attr.name === attributeName);
        if (!associationsAttr) {
          return [];
        }
        const associatedProductSearchItems: ProductProjection[] = [];

        // look up each associated product,
        const allAssociatedProductPromises = (associationsAttr.value as string[]).map(async (associatedProductId) => {
            // Get the associated product to find its variants
            const associatedProduct = client
              .productProjections()
              .withKey({ key: associatedProductId })
              .get()
              .execute().catch( () => null );
            return associatedProduct;
        });

        const associatedProductsResults = await Promise.all(allAssociatedProductPromises);
        const validAssociatedProductsResults = associatedProductsResults.filter(result => !!result).slice(0, maxNumberOfAssociations);
        for (const associatedProductResult of validAssociatedProductsResults) {
          associatedProductSearchItems.push(associatedProductResult.body);
        }
        return associatedProductSearchItems;
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

    const result = associatedProducts.map((product) =>
      this.factory.parseAssociation(this.context, {
        sourceProductKey: query.forProduct.key,
        relation: 'accessory',
        product,
      }),
    );

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

    const result = associatedProducts.map((product) =>
      this.factory.parseAssociation(this.context, {
        sourceProductKey: query.forProduct.key,
        relation: 'sparepart',
        product,
      }),
    );

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

    const result = associatedProducts.map((product) =>
      this.factory.parseAssociation(this.context, {
        sourceProductKey: query.forProduct.key,
        relation: 'replacement',
        product,
      }),
    );

    return success(result);
  }

}
