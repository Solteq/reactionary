import type {
  Category,
  CategoryPaginatedResult,
  Cache,
  Inventory,
  LanguageContext,
  Price,
  Product,
  ProductRatingSummary,
  ProductReviewPaginatedResult,
  ProductSearchResult,
  RequestContext,
  Result,
  SearchIdentifier,
  Store,
} from '@reactionary/core';

export interface ReactionaryFeedClient {
  cache?: Cache;
  productSearch?: {
    queryByTerm(payload: unknown): Promise<Result<ProductSearchResult>>;
  };
  product?: {
    getBySKU(payload: unknown): Promise<Result<Product>>;
  };
  productReviews?: {
    getRatingSummary(payload: unknown): Promise<Result<ProductRatingSummary>>;
    findReviews(payload: unknown): Promise<Result<ProductReviewPaginatedResult>>;
  };
  price?: {
    getCustomerPrice(payload: unknown): Promise<Result<Price>>;
    getListPrice(payload: unknown): Promise<Result<Price>>;
  };
  inventory?: {
    getBySKU(payload: unknown): Promise<Result<Inventory>>;
  };
  category?: {
    getBreadcrumbPathToCategory?(payload: unknown): Promise<Result<Category[]>>;
    findTopCategories(payload: unknown): Promise<Result<CategoryPaginatedResult>>;
    findChildCategories(payload: unknown): Promise<Result<CategoryPaginatedResult>>;
  };
  store?: {
    queryByProximity(payload: unknown): Promise<Result<Store[]>>;
  };
}

export type ValidatedReactionaryFeedClient = ReactionaryFeedClient & {
  productSearch: NonNullable<ReactionaryFeedClient['productSearch']>;
  product: NonNullable<ReactionaryFeedClient['product']>;
  price: NonNullable<ReactionaryFeedClient['price']>;
  inventory: NonNullable<ReactionaryFeedClient['inventory']>;
};

export type ReactionaryFeedClientFactory<
  TClient extends ReactionaryFeedClient = ReactionaryFeedClient,
> = (
  requestContext: RequestContext,
) => TClient;

export interface ReactionaryFeedInventoryOptions {
  defaultFulfillmentCenterKeys?: string[];
}

export interface ReactionaryFeedProcessingOptions {
  productConcurrency?: number;
}

export interface ReactionaryFeedProgress {
  phase: 'searching' | 'generating' | 'completed';
  processedProducts: number;
  totalProducts?: number;
  pageNumber?: number;
  totalPages?: number;
  elapsedMs: number;
}

export interface ReactionaryFeedGeneratorOptions
  extends ReactionaryFeedInventoryOptions,
    ReactionaryFeedProcessingOptions {
  onProgress?: (progress: ReactionaryFeedProgress) => void;
}

export interface ReactionaryFeedDefinition {
  languageContext: LanguageContext;
  search: SearchIdentifier;
  pageSize?: number;
  maxPages?: number;
  fulfillmentCenterKeys?: string[];
  fulfillmentCenterKey?: string;
  productUrlBase?: string;
  sellerName?: string;
  metadata?: Record<string, unknown>;
}

export type ReactionarySitemapChangeFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export interface ReactionarySitemapEntry {
  url: string;
  lastmod?: Date | string;
  changefreq?: ReactionarySitemapChangeFrequency;
  priority?: number;
}

export interface ReactionarySitemapBaseDefinition {
  languageContext: LanguageContext;
  changefreq?: ReactionarySitemapChangeFrequency;
  priority?: number;
}

export interface ReactionaryProductSitemapDefinition
  extends Partial<ReactionarySitemapBaseDefinition> {
  type: 'products';
  feed: string;
}

export interface ReactionaryCategorySitemapDefinition
  extends ReactionarySitemapBaseDefinition {
  type: 'categories';
  urlTemplate: string;
  pageSize?: number;
  maxPagesPerLevel?: number;
  maxDepth?: number;
  includeChildren?: boolean;
}

export interface ReactionaryStoreSitemapDefinition
  extends ReactionarySitemapBaseDefinition {
  type: 'stores';
  urlTemplate: string;
  proximity: {
    longitude: number;
    latitude: number;
    distance: number;
    limit: number;
  };
}

export type ReactionarySitemapDefinition =
  | ReactionaryProductSitemapDefinition
  | ReactionaryCategorySitemapDefinition
  | ReactionaryStoreSitemapDefinition;

export interface ReactionarySitemapOptions {
  baseUrl: string;
  sources: Record<string, ReactionarySitemapDefinition>;
  include?: string[];
}

export interface ReactionaryFeedImage {
  url: string;
  altText?: string;
}

export interface ReactionaryFeedMoney {
  value: number;
  currency: string;
}

export interface ReactionaryFeedBarcode {
  type: 'ean' | 'gtin' | 'upc' | 'barcode';
  value: string;
}

export interface ReactionaryFeedVariantOption {
  name: string;
  value: string;
}

export interface ReactionaryFeedAvailability {
  available: boolean;
  status: 'in_stock' | 'out_of_stock' | 'backorder' | 'preorder' | 'discontinued';
  quantity?: number;
}

export interface ReactionaryFeedCategory {
  id: string;
  name: string;
  slug?: string;
}

export interface ReactionaryFeedRatingSummary {
  averageRating: number;
  totalRatings?: number;
  ratingDistribution?: Record<string, number>;
}

export interface ReactionaryFeedReview {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  content: string;
  createdAt: string;
  verified: boolean;
}

export interface ReactionaryFeedVariant {
  id: string;
  title: string;
  description?: string;
  url?: string;
  ean?: string;
  gtin?: string;
  upc?: string;
  barcode?: string;
  manufacturerPartNumber?: string;
  images: ReactionaryFeedImage[];
  price?: ReactionaryFeedMoney;
  listPrice?: ReactionaryFeedMoney;
  availability?: ReactionaryFeedAvailability;
  barcodes: ReactionaryFeedBarcode[];
  options: ReactionaryFeedVariantOption[];
  metadata?: Record<string, unknown>;
}

export interface ReactionaryFeedProduct {
  id: string;
  title: string;
  description?: string;
  url?: string;
  brand?: string;
  manufacturer?: string;
  categoryPath?: ReactionaryFeedCategory[];
  ratingSummary?: ReactionaryFeedRatingSummary;
  reviews?: ReactionaryFeedReview[];
  images: ReactionaryFeedImage[];
  variants: ReactionaryFeedVariant[];
  metadata?: Record<string, unknown>;
}

export interface ReactionaryFeedGenerateInput {
  feedId: string;
  feed: ReactionaryFeedDefinition;
  requestContext: RequestContext;
}

export function assertReactionaryFeedClient(
  client: ReactionaryFeedClient,
): asserts client is ValidatedReactionaryFeedClient {
  const missing = getMissingFeedClientOperations(client);

  if (missing.length > 0) {
    throw new Error(
      `Reactionary feed generator cannot initialize because the client is missing required operations: ${missing.join(', ')}`,
    );
  }
}

export function getMissingFeedClientOperations(
  client: ReactionaryFeedClient,
): string[] {
  return [
    ['productSearch.queryByTerm', client.productSearch?.queryByTerm],
    ['product.getBySKU', client.product?.getBySKU],
    ['price.getCustomerPrice', client.price?.getCustomerPrice],
    ['price.getListPrice', client.price?.getListPrice],
    ['inventory.getBySKU', client.inventory?.getBySKU],
  ]
    .filter(([, operation]) => typeof operation !== 'function')
    .map(([name]) => name as string);
}

export function getMissingSitemapClientOperations(
  client: ReactionaryFeedClient,
  source: ReactionarySitemapDefinition,
): string[] {
  if (source.type === 'products') {
    return getMissingFeedClientOperations(client);
  }

  if (source.type === 'categories') {
    return [
      ['category.findTopCategories', client.category?.findTopCategories],
      ['category.findChildCategories', client.category?.findChildCategories],
    ]
      .filter(([, operation]) => typeof operation !== 'function')
      .map(([name]) => name as string);
  }

  return [
    ['store.queryByProximity', client.store?.queryByProximity],
  ]
    .filter(([, operation]) => typeof operation !== 'function')
    .map(([name]) => name as string);
}

export function assertReactionarySitemapClient(
  client: ReactionaryFeedClient,
  source: ReactionarySitemapDefinition,
): void {
  const missing = getMissingSitemapClientOperations(client, source);

  if (missing.length > 0) {
    throw new Error(
      `Reactionary sitemap source cannot initialize because the client is missing required operations: ${missing.join(', ')}`,
    );
  }
}
