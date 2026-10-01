import type {
  Inventory,
  LanguageContext,
  Price,
  Product,
  ProductSearchResult,
  RequestContext,
  Result,
  SearchIdentifier,
} from '@reactionary/core';

export interface ReactionaryFeedClient {
  productSearch?: {
    queryByTerm(payload: unknown): Promise<Result<ProductSearchResult>>;
  };
  product?: {
    getBySKU(payload: unknown): Promise<Result<Product>>;
  };
  price?: {
    getCustomerPrice(payload: unknown): Promise<Result<Price>>;
    getListPrice(payload: unknown): Promise<Result<Price>>;
  };
  inventory?: {
    getBySKU(payload: unknown): Promise<Result<Inventory>>;
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

export interface ReactionaryFeedDefinition {
  languageContext: LanguageContext;
  search: SearchIdentifier;
  pageSize?: number;
  maxPages?: number;
  fulfillmentCenterKey?: string;
  productUrlBase?: string;
  metadata?: Record<string, unknown>;
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

export interface ReactionaryFeedVariant {
  id: string;
  title: string;
  description?: string;
  url?: string;
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
