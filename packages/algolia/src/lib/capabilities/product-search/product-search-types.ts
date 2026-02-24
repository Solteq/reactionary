import type {
  ProductSearchResult,
  ProductRecommendationIdentifier,
  SearchIdentifier,
} from '@reactionary/core';

export type AlgoliaProductSearchIdentifier = SearchIdentifier & {
  key: string;
  index: string;
};

export type AlgoliaProductSearchResult = ProductSearchResult & {
  identifier: AlgoliaProductSearchIdentifier;
};

export type AlgoliaProductRecommendationIdentifier = ProductRecommendationIdentifier & {
  abTestID?: number;
  abTestVariantID?: number;
};

export interface AlgoliaNativeVariant {
  sku: string;
  image: string;
}

export interface AlgoliaNativeRecord {
  objectID: string;
  slug?: string;
  name?: string;
  variants: AlgoliaNativeVariant[];
}
