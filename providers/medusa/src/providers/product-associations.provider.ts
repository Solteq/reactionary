import {
  ProductAssociationsProvider,
  Reactionary,
  ImageSchema,
  ProductSearchResultItemVariantSchema,
  ProductVariantIdentifierSchema,
  success,
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
} from '@reactionary/core';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import type { MedusaAPI } from '../core/client.js';
import type { StoreProduct, StoreProductVariant } from '@medusajs/types';

export class MedusaProductAssociationsProvider extends ProductAssociationsProvider {
  protected config: MedusaConfiguration;
  protected medusa: MedusaAPI;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    medusa: MedusaAPI
  ) {
    super(cache, context);
    this.config = config;
    this.medusa = medusa;
  }

  protected async fetchAssociatedProductsFor(productKey: ProductIdentifier, maxNumberOfAssociations: number, attributeName: string): Promise<ProductSearchResultItem[]> {
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

    return associatedProductsResponse.products.map(product => this.parseSingle(product));
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

  protected parseSingle(_body: StoreProduct): ProductSearchResultItem {
    const heroVariant = _body.variants?.[0];
    const identifier = { key: _body.external_id || _body.id};
    const slug = _body.handle;
    const name = heroVariant?.title || _body.title;
    const variants = [];
    if (heroVariant) {
      variants.push(this.parseVariant(heroVariant, _body));
    }

    const result = {
      identifier,
      name,
      slug,
      variants,
    } satisfies ProductSearchResultItem;

    return result;
  }


  protected parseVariant(
    variant: StoreProductVariant,
    product: StoreProduct
  ): ProductSearchResultItemVariant {
    const img = ImageSchema.parse({
      sourceUrl: product.images?.[0].url ?? '',
      altText: product.title || undefined,
    });

    return ProductSearchResultItemVariantSchema.parse({
      variant: ProductVariantIdentifierSchema.parse({
        sku: variant.sku || '',
      } satisfies ProductVariantIdentifier),
      image: img,
    } satisfies Partial<ProductSearchResultItemVariant>);
  }

}
