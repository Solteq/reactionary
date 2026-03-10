import {
  ProductAssociationsCapability,
  Reactionary,
  type ProductAssociationsGetAccessoriesQuery,
  type ProductAssociationsGetSparepartsQuery,
  type ProductAssociationsGetReplacementsQuery,
  type Result,
  success,
  type ProductAssociation,
  type Cache,
  type ProductSearchResultItem,
  type RequestContext,
} from '@reactionary/core';
import type {
  ProductAssociationsFactory,
  ProductAssociationsFactoryOutput,
  ProductAssociationsFactoryWithOutput,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { en, Faker } from '@faker-js/faker';
import { calcSeed } from '../utilities/seed.js';
import type { FakeProductAssociationsFactory } from '../factories/product-associations/product-associations.factory.js';

export class FakeProductAssociationsCapability<
  TFactory extends ProductAssociationsFactory = FakeProductAssociationsFactory,
> extends ProductAssociationsCapability<ProductAssociationsFactoryOutput<TFactory>> {
  protected config: FakeConfiguration;
  protected factory: ProductAssociationsFactoryWithOutput<TFactory>;
  protected faker: Faker;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: ProductAssociationsFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
    this.faker = new Faker({ locale: [en] });
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
    const associatedProducts = this.generateFakeAssociatedProducts(query.forProduct.key, query.numberOfAccessories || 4, 'accessory');

    const result: ProductAssociation[] = associatedProducts.map(product => ({
      associationIdentifier: {
        key: `${query.forProduct.key}-accessory-${product.identifier.key}`
      },
      associationReturnType: 'productSearchResultItem',
      product,
    } satisfies ProductAssociation));

    return success(result.map((x) => this.factory.parseAssociation(this.context, x)));
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
    const associatedProducts = this.generateFakeAssociatedProducts(query.forProduct.key, query.numberOfSpareparts || 4, 'sparepart');

    const result: ProductAssociation[] = associatedProducts.map(product => ({
      associationIdentifier: {
        key: `${query.forProduct.key}-sparepart-${product.identifier.key}`
      },
      associationReturnType: 'productSearchResultItem',
      product,
    } satisfies ProductAssociation));

    return success(result.map((x) => this.factory.parseAssociation(this.context, x)));
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
    const associatedProducts = this.generateFakeAssociatedProducts(query.forProduct.key, query.numberOfReplacements || 4, 'replacement');

    const result: ProductAssociation[] = associatedProducts.map(product => ({
      associationIdentifier: {
        key: `${query.forProduct.key}-replacement-${product.identifier.key}`
      },
      associationReturnType: 'productSearchResultItem',
      product,
    } satisfies ProductAssociation));

    return success(result.map((x) => this.factory.parseAssociation(this.context, x)));
  }

  private generateFakeAssociatedProducts(baseProductKey: string, count: number, type: string): ProductSearchResultItem[] {
    const products: ProductSearchResultItem[] = [];

    const seed = calcSeed(baseProductKey);
    this.faker.seed(seed);

    /**
     * Unittest compatibility
     */
    if (baseProductKey.includes('unknown')) {
      return [];
    }
    if (baseProductKey === 'product_100201') {
      return [];
    }

    const hasAnyAssociations = this.faker.datatype.boolean({ probability: 0.5 }); // 50% chance that the product has associations
    if (!hasAnyAssociations) {
      return [];
    }

    const numberOfAssociations = Math.min(count, this.faker.number.int({ min: 2, max: 12 }));




    for (let i = 0; i < numberOfAssociations; i++) {
      const key = `${baseProductKey}-${type}-${i + 1}`;
      products.push({
        identifier: { key },
        name: `Fake ${type} ${i + 1} for ${baseProductKey}`,
        slug: key,
        variants: [{
          variant: { sku: `${key}-variant` },
          image: {
            sourceUrl: `https://via.placeholder.com/300x300?text=${type}+${i + 1}`,
            altText: `Image for ${type} ${i + 1}`,
          },
        }],
      });
    }

    return products;
  }
}
