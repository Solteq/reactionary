import {
  ProductAssociationsProvider,
  Reactionary,
  type ProductAssociationsGetAccessoriesQuery,
  type ProductAssociationsGetSparepartsQuery,
  type ProductAssociationsGetReplacementsQuery,
  type Result,
  success,
  type ProductAssociation,
  type ProductSearchResultItem,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';
import { calcSeed } from '../utilities/seed.js';

export class FakeProductAssociationsProvider extends ProductAssociationsProvider {
  protected config: FakeConfiguration;
  protected faker: Faker;

  constructor(
    config: FakeConfiguration,
    cache: any,
    context: any
  ) {
    super(cache, context);
    this.config = config;
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
  ): Promise<Result<ProductAssociation[]>> {
    const associatedProducts = this.generateFakeAssociatedProducts(query.forProduct.key, query.numberOfAccessories || 4, 'accessory');

    const result: ProductAssociation[] = associatedProducts.map(product => ({
      associationIdentifier: {
        key: `${query.forProduct.key}-accessory-${product.identifier.key}`
      },
      associationReturnType: 'productSearchResultItem',
      product,
    } satisfies ProductAssociation));

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
  ): Promise<Result<ProductAssociation[]>> {
    const associatedProducts = this.generateFakeAssociatedProducts(query.forProduct.key, query.numberOfSpareparts || 4, 'sparepart');

    const result: ProductAssociation[] = associatedProducts.map(product => ({
      associationIdentifier: {
        key: `${query.forProduct.key}-sparepart-${product.identifier.key}`
      },
      associationReturnType: 'productSearchResultItem',
      product,
    } satisfies ProductAssociation));

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
  ): Promise<Result<ProductAssociation[]>> {
    const associatedProducts = this.generateFakeAssociatedProducts(query.forProduct.key, query.numberOfReplacements || 4, 'replacement');

    const result: ProductAssociation[] = associatedProducts.map(product => ({
      associationIdentifier: {
        key: `${query.forProduct.key}-replacement-${product.identifier.key}`
      },
      associationReturnType: 'productSearchResultItem',
      product,
    } satisfies ProductAssociation));

    return success(result);
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
