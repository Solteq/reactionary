import {
  ProductAssociationsProvider,
  Reactionary,
  ImageSchema,
  ProductVariantOptionSchema,
  ProductOptionIdentifierSchema,
  ProductSearchResultItemVariantSchema,
  ProductVariantIdentifierSchema,
  success,
  error,
} from '@reactionary/core';
import type {
  ProductVariantIdentifier,
  ProductIdentifier,
  ProductAssociation,
  ProductSearchResultItem,
  ProductSearchResultItemVariant,
  ProductAssociationsGetAccessoriesQuery,
  ProductAssociationsGetSparepartsQuery,
  ProductAssociationsGetReplacementsQuery,
  Result,
  RequestContext,
  Cache,
  ProductOptionIdentifier,
  ProductVariantOption,
  NotFoundError,
} from '@reactionary/core';
import type { ProductProjection, ProductVariant as CTProductVariant } from '@commercetools/platform-sdk';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsAPI } from '../core/client.js';

export class CommercetoolsProductAssociationsProvider extends ProductAssociationsProvider {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI
  ) {
    super(cache, context);
    this.config = config;
    this.commercetools = commercetools;
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  protected async fetchAssociatedProductsFor(productKey: ProductIdentifier, maxNumberOfAssociations: number, attributeName: string): Promise<ProductSearchResultItem[]> {
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
        const associatedProductSearchItems: ProductSearchResultItem[] = [];

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
          const resultItem = this.parseSingle(associatedProductResult.body);
          if (resultItem) {
            associatedProductSearchItems.push(resultItem);
          }
        }
        return associatedProductSearchItems;
    }


  protected parseSingle(body: ProductProjection) {
    const identifier = { key: body.id };
    const name = body.name[this.context.languageContext.locale] || body.id;
    const slug = body.slug?.[this.context.languageContext.locale] || body.id;
    const variants = [body.masterVariant, ...body.variants].map((variant) =>
      this.parseVariant(variant, body)
    );

    const product = {
      identifier,
      name,
      slug,
      variants,
    } satisfies ProductSearchResultItem;

    return product;
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

    const associatedProducts = await this.fetchAssociatedProductsFor(query.forProduct, query.numberOfAccessories || 4, 'reactionaryaccessories');

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
    const associatedProducts = await this.fetchAssociatedProductsFor(query.forProduct, query.numberOfSpareparts || 4, 'reactionaryspareparts');

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
    const associatedProducts = await this.fetchAssociatedProductsFor(query.forProduct, query.numberOfReplacements || 4, 'reactionaryreplacements');

    const result: ProductAssociation[] = associatedProducts.map(product => ({
      associationIdentifier: {
        key: `${query.forProduct.key}-replacement-${product.identifier.key}`
      },
      associationReturnType: 'productSearchResultItem',
      product,
    } satisfies ProductAssociation));

    return success(result);
  }




  protected parseVariant(
    variant: CTProductVariant,
    product: ProductProjection
  ): ProductSearchResultItemVariant {
    const sourceImage = variant.images?.[0];

    const img = ImageSchema.parse({
      sourceUrl: sourceImage?.url || '',
      height: sourceImage?.dimensions.h || undefined,
      width: sourceImage?.dimensions.w || undefined,
      altText:
        sourceImage?.label ||
        product.name[this.context.languageContext.locale] ||
        undefined,
    });

    const mappedOptions =
      variant.attributes
        ?.filter((x) => x.name === 'Color')
        .map((opt) =>
          ProductVariantOptionSchema.parse({
            identifier: ProductOptionIdentifierSchema.parse({
              key: opt.name,
            } satisfies Partial<ProductOptionIdentifier>),
            name: opt.value || '',
          } satisfies Partial<ProductVariantOption>)
        ) || [];

    const mappedOption = mappedOptions?.[0];

    return ProductSearchResultItemVariantSchema.parse({
      variant: ProductVariantIdentifierSchema.parse({
        sku: variant.sku || '',
      } satisfies ProductVariantIdentifier),
      image: img,
      options: mappedOption,
    } satisfies Partial<ProductSearchResultItemVariant>);
  }
}
