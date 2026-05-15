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
  /** Raw (pre-CDN-transform) full image path. Present in standard HCL_V2 detail profiles. */
  fullImageRaw?: string;
  /** Raw (pre-CDN-transform) thumbnail path. Present in standard HCL_V2 detail profiles. */
  thumbnailRaw?: string;
}

/**
 * A product item as returned by HCL search profiles
 * (e.g. HCL_V2_findProductsBySearchTermWithPrice, HCL_V2_findProductsByCategoryWithPriceRange).
 *
 * Search profile responses contain aggregated entries without nested SKU items[].
 * Attribute values may be arrays (aggregated across all variants of the group).
 * Use this type in product-search factories.
 */
export interface HclProductSearchItem {
  id: string;
  partNumber: string;
  name: string;
  shortDescription: string;
  /** Absent in search profiles — only populated in detail profiles. */
  longDescription?: string;
  thumbnail: string;
  /** Raw (pre-CDN-transform) thumbnail path. Standard HCL_V2 field. */
  thumbnailRaw?: string;
  /**
   * Full-size image URL. Absent in search profiles (HCL_V2_findProductsBySearchTerm*).
   * Present in detail profiles (HCL_V2_findProductByPartNumber_Details).
   */
  fullImage?: string;
  /** 'product' | 'item' | 'variant' | 'package' | 'bundle' */
  type: string;
  catalogEntryTypeCode?: string;
  hasSingleSKU: boolean;
  /** 'true' | 'false' */
  buyable: string;
  sellerId: string;
  /** Absent in search profiles. */
  seller?: string;
  manufacturer: string;
  /** Absent in search profiles. */
  numberOfSKUs?: number;
  /** Absent in search profiles. */
  sequence?: string;
  /** Internal HCL store ID. Standard HCL_V2 field. */
  storeID?: string;
  seo?: HclSeo;
  parentCatalogGroupID: string | string[];
  parentCatalogEntryID?: string;
  price: HclPrice[];
  /**
   * Descriptive/Defining attributes. Present in detail profiles and some
   * search profiles (server-dependent). Always treat as optional.
   */
  attributes?: HclProductAttribute[];
  /** Aggregated variant pricing/grouping data — present only in search profile responses */
  groupingProperties?: HclGroupingProperties;
}

/**
 * A full product entry as returned by HCL detail profiles
 * (e.g. HCL_V2_findProductByPartNumber_Details).
 *
 * Extends HclProductSearchItem with detail-only fields: nested SKU items[],
 * attachments, images, and merchandising associations.
 * Use this type in product detail factories.
 */
export interface HclProductResponse extends HclProductSearchItem {
  /** Variant SKUs with full detail data — only present in detail profile responses */
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
  /**
   * Raw (pre-CDN-transform) full image path. Standard HCL_V2 field in detail profiles.
   * For SKU items, also present as a sibling of `fullImage`.
   */
  fullImageRaw?: string;
  /**
   * Link to parent category API endpoint. Standard HCL_V2 field on SKU-level items.
   * e.g. `/search/resources/api/v2/categories?storeId=41&id=10507`
   */
  parent?: string;
}

export interface HclFacetEntry {
  /** The API returns count as number or string depending on facet type. */
  count: number | string;
  /** Display label shown to the user */
  label: string;
  name: string;
  /** The filterable value, e.g. an attribute value or category ID */
  value: string;
  term: string;
  frequency: string;
  fullPath: string;
  fullPathCategoryIds: string;
  image: string;
  shortDescription: string;
}

/**
 * A single facet group as returned in HCL product search responses.
 * Reference: karkkainen-commerce-storefront/integration/data/core/types/Product.ts
 */
export interface HclFacet {
  /** The facet key/identifier, e.g. "manufacturer" */
  value: string;
  name: string;
  entry: HclFacetEntry[];
}

export interface HclProductQueryResponse {
  recordSetCount?: number;
  recordSetTotal?: number;
  recordSetStartNumber?: number;
  recordSetComplete?: boolean;
  /** v2 query service total count field */
  total?: number;
  /** Standard v2/products response array */
  contents?: HclProductResponse[];
  /** Used by some profiles (e.g. productview) */
  catalogEntryView?: HclProductResponse[];
  facets?: HclFacet[];
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
  /** Internal token record ID */
  id?: string;
  /** Store ID for this token */
  storeId?: string;
  /** Token status code (1 = active) */
  status?: number;
  /** Locale string, e.g. 'en_US' */
  language?: string;
  /** Store type, e.g. 'CPS' */
  'store.type'?: string;
  redirect?: string;
  page?: {
    /** Page template name, e.g. 'PRODUCT_PAGE' or 'CATEGORY_PAGE' */
    name?: string;
    type: string;
    title: string;
    metaDescription: string;
    metaKeyword: string;
    imageAlternateDescription?: string;
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
  /** Not present in actual API responses — kept optional for forward-compatibility */
  id?: string;
  /** Full SEO URL path, e.g. "/Electronics/c/Electronics" */
  href: string;
}

/**
 * Navigation links returned alongside each category entry.
 * Note: `children` links are plain strings in format "href: <url>", not objects.
 */
export interface HclCategoryLinks {
  parent?: { href: string };
  children?: string[];
  self?: { href: string };
}

/**
 * A single category entry as returned by the HCL Commerce Query Service.
 */
export interface HclCategoryResponse {
  uniqueID: string;
  /** Alias for uniqueID — both fields are returned by the API */
  id?: string;
  /** Human-readable URL slug / identifier, e.g. "Electronics" */
  identifier: string;
  name: string;
  shortDescription?: string;
  longDescription?: string;
  description?: string;
  thumbnail?: string;
  fullImage?: string;
  sequence: string;
  /** Internal HCL store ID. Standard HCL_V2 field. */
  storeID?: string;
  seo: HclCategorySeo;
  /** Parent category uniqueID — may be a root marker value like "-1" or "0" */
  parentCatalogGroupID: string;
  children?: HclCategoryResponse[];
  links?: HclCategoryLinks;
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
  /**
   * Active facet filter values to apply (repeated param).
   * Each entry is the URL-encoded value from HclFacetEntry.value,
   * e.g. 'manufacturer.raw%3A%22Home+Design%22'.
   */
  facets?: string[];
}
