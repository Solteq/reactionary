/**
 * HCL Commerce Query Service response types.
 * Shaped from the actual API response, which is richer than the generated OpenAPI contracts.
 * Reference: karkkainen-commerce-storefront/integration/data/core/types/Product.ts
 */

export interface HclPrice {
  usage: string; // 'Offer' | 'Display'
  description: string;
  currency: string;
  value: string;
}

export interface HclProductAttributeValue {
  identifier: string | string[];
  sequence: string | string[];
  unitOfMeasure: string | string[];
  unitID: string | string[];
  image1: string | string[];
  image1path: string | string[];
  value: string | string[];
  id: string | string[];
  attributeIdentifier?: string;
}

export interface HclProductAttribute {
  id: string;
  identifier: string;
  name: string;
  usage: string; // 'Defining' | 'Descriptive'
  displayable: string; // 'true' | 'false'
  storeDisplay: string; // 'true' | 'false'
  facetable: string;
  comparable: string;
  searchable: string;
  swatchable: string;
  merchandisable: string;
  sequence: string;
  associatedKeyword: string;
  values: HclProductAttributeValue[];
}

export interface HclAttachment {
  mimeType: string;
  attachmentAssetPath: string;
  name: string;
  attachmentAssetID: string;
}

export interface HclSeo {
  href: string;
  tokenValue?: string;
}

export interface HclGroupingProperties {
  groupCount: number;
  groupHero: string;
  groupListPriceRange: [string, string];
  groupOfferPriceRange: [string, string];
  groupMinPriceValue: string;
  groupMaxPriceValue: string;
}

export interface HclImage {
  name: string;
  sequence: string;
  fullImage: string;
  thumbnail: string;
}

/**
 * A single product entry as returned by the HCL Commerce Query Service.
 * Applies to both parent products and SKU-level items (items[]).
 */
export interface HclProductResponse {
  id: string;
  partNumber: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  thumbnail: string;
  fullImage: string;
  /** 'product' | 'item' | 'variant' | 'package' | 'bundle' */
  type: string;
  catalogEntryTypeCode?: string;
  hasSingleSKU: boolean;
  /** 'true' | 'false' */
  buyable: string;
  sellerId: string;
  seller: string;
  manufacturer: string;
  numberOfSKUs: number;
  sequence: string;
  seo?: HclSeo;
  parentCatalogGroupID: string | string[];
  parentCatalogEntryID?: string;
  price: HclPrice[];
  attributes: HclProductAttribute[];
  /** Variant SKUs (items in HCL terminology) */
  items: HclProductResponse[];
  /** Kit/bundle SKU list */
  sKUs?: HclProductResponse[];
  /** Kit/bundle component list */
  components?: HclProductResponse[];
  /** Quantity — only present on components array elements */
  quantity?: string;
  merchandisingAssociations?: HclProductResponse[];
  attachments?: HclAttachment[];
  images?: HclImage[];
  groupingProperties?: HclGroupingProperties;
}

export interface HclProductQueryResponse {
  recordSetCount: number;
  recordSetTotal: number;
  recordSetStartNumber: number;
  recordSetComplete: boolean;
  /** Standard v2/products response array */
  contents?: HclProductResponse[];
  /** Used by some profiles (e.g. productview) */
  catalogEntryView?: HclProductResponse[];
}

/**
 * Response from /api/v2/urls — resolves a URL slug to a token/identifier.
 * Reference: karkkainen-commerce-storefront/integration/data/core/types/IncomingContent.ts
 */
export interface HclUrlResponse {
  /** The URL slug that was looked up */
  identifier: string;
  /** The type of the resolved entity, e.g. 'ProductToken' | 'CategoryToken' */
  tokenName: string;
  /** The partNumber (product) or id (category) of the resolved entity */
  tokenExternalValue: string;
  /** Internal HCL token value */
  tokenValue: string;
  redirect?: string;
  page?: {
    type: string;
    title: string;
    metaDescription: string;
    metaKeyword: string;
    redirect?: string;
  };
}

export interface HclUrlQueryResponse {
  contents?: HclUrlResponse[];
}

/**
 * SEO data for a category as returned by /api/v2/categories.
 * Reference: karkkainen-commerce-storefront/integration/data/core/types/Category.ts
 */
export interface HclCategorySeo {
  id: string;
  /** Full SEO URL path, e.g. "/Electronics/c/Electronics" */
  href: string;
}

/**
 * A single category entry as returned by the HCL Commerce Query Service.
 */
export interface HclCategoryResponse {
  uniqueID: string;
  /** Human-readable URL slug / identifier, e.g. "Electronics" */
  identifier: string;
  name: string;
  shortDescription: string;
  description: string;
  thumbnail: string;
  fullImage: string;
  sequence: string;
  seo: HclCategorySeo;
  /** Parent category uniqueID — may be a root marker value like "-1" or "0" */
  parentCatalogGroupID: string;
  children?: HclCategoryResponse[];
}

export interface HclCategoryQueryResponse {
  contents?: HclCategoryResponse[];
}

export interface HclFindCategoriesQuery {
  storeId?: string;
  catalogId?: string;
  langId?: string;
  /** Filter by category uniqueID */
  id?: string[];
  /** Filter by category identifier (slug) */
  identifier?: string[];
  /** Limit child categories to those under this parent uniqueID */
  parentCategoryId?: string;
  /** Controls depth and breadth: "depth,limit" e.g. "1,0" means 1 level deep, no count limit */
  depthAndLimit?: string;
  profileName?: string;
}

export interface HclFindProductsQuery {
  storeId?: string;
  catalogId?: string;
  langId?: string;
  currency?: string;
  /** Filter by HCL product IDs */
  id?: string[];
  /** Filter by part numbers (product or SKU level) */
  partNumber?: string[];
  categoryId?: string;
  searchTerm?: string;
  contractId?: string;
  /** Profile name controlling the subset of data returned */
  profileName?: string;
  limit?: number;
  offset?: number;
  checkEntitlement?: boolean;
}
