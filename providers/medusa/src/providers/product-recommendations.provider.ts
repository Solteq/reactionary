import type { StoreProduct, StoreProductVariant } from '@medusajs/types';
import {
  error,
  ImageSchema,
  ProductRecommendationsProvider,
  ProductSearchResultItemVariantSchema,
  ProductVariantIdentifierSchema,
  success,
  type Cache,
  type NotFoundError,
  type ProductRecommendation,
  type ProductRecommendationsByCollectionQuery,
  type ProductSearchResultItem,
  type ProductSearchResultItemVariant,
  type ProductVariantIdentifier,
  type RequestContext,
  type Result
} from '@reactionary/core';
import createDebug from 'debug';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

const debug = createDebug('reactionary:medusa:product-recommendations');

/**
 * MedusaProductRecommendationsProvider
 *
 * Provides product recommendations using Medusa's collection-based product grouping.
 * Only overrides the getCollection method to fetch products from Medusa collections.
 *
 * Note: This implementation leverages Medusa's product collections feature to provide
 * curated product recommendations. Collections are typically manually managed or
 * created through Medusa's admin panel or API.
 */
export class MedusaProductRecommendationsProvider extends ProductRecommendationsProvider {
  protected config: MedusaConfiguration;
  protected medusaApi: MedusaAPI;

  constructor(config: MedusaConfiguration, cache: Cache, context: RequestContext, medusaApi: MedusaAPI) {
    super(cache, context);
    this.config = config;
    this.medusaApi = medusaApi;
  }

  /**
   * Get product recommendations from a Medusa collection
   *
   * This method fetches products from a specific Medusa collection by name or handle.
   * It's useful for displaying curated product lists like "Featured Products",
   * "New Arrivals", "Best Sellers", etc.
   */
  public override async getCollection(
    query: ProductRecommendationsByCollectionQuery
  ): Promise<Result<ProductRecommendation[]>> {
    const client = await this.medusaApi.getClient();

    try {
      if (debug.enabled) {
        debug(`Fetching collection: ${query.collectionName}`);
      }

      // First, find the collection by handle/name
      const collectionsResponse = await client.store.collection.list({
        handle: query.collectionName,
        limit: 1,
      });

      if (!collectionsResponse.collections || collectionsResponse.collections.length === 0) {
        if (debug.enabled) {
          debug(`Collection not found: ${query.collectionName}`);
        }
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: query.collectionName
        });
      }

      const collection = collectionsResponse.collections[0];

      if (debug.enabled) {
        debug(`Found collection: ${collection.title} (${collection.id})`);
      }

      // Fetch products from the collection
      const productsResponse = await client.store.product.list({
        collection_id: [collection.id],
        limit: query.numberOfRecommendations,
        fields: '+variants.id,+variants.sku',
      });

      if (debug.enabled) {
        debug(`Found ${productsResponse.products.length} products in collection`);
      }

      // Map products to recommendations
      const recommendations: ProductRecommendation[] = [];



      for (const productRes of productsResponse.products) {
        const product = this.parseSearchResultItem(productRes);
        recommendations.push({
          recommendationIdentifier: {
            key: `${collection.id}_${productRes.id}`,
            algorithm: 'collection',
          },
          recommendationReturnType: 'productSearchResultItem',
          product: product,
        });
      }

      if (debug.enabled) {
        debug(`Returning ${recommendations.length} recommendations`);
      }

      return success(recommendations);
    } catch (error) {
      if (debug.enabled) {
        debug(`Error fetching collection recommendations: %O`, error);
      }
      console.error('Error fetching collection recommendations:', error);
      return success([]);
    }
  }

  protected parseSearchResultItem(_body: StoreProduct) {
     const heroVariant = _body.variants?.[0];
     const identifier = { key: _body.id };
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
