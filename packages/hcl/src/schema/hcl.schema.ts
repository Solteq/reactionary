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
  /** B2B contract identifier. Present on Offer-usage entries when a contract price applies. */
  contractId?: string;
}

/**
 * A single unit price entry in a /display_price response item.
 * `value` is already a number (unlike the inline `HclPrice.value` which is a string).
 */
export interface HclDisplayPriceUnitPrice {
  price?: {
    currency?: string;
    /** Numeric value — already a number, not a string. */
    value?: number;
  };
  quantity?: { value?: number; uom?: string };
}

/**
 * A single item in the `resultList` of a /display_price response.
 * Returned for both `byPartNumbersAndPriceRuleId` and `byCatalogEntryIds*` query variants.
 */
export interface HclDisplayPriceItem {
  partNumber: string;
  priceRuleId?: string;
  priceRuleName?: string;
  catalogEntryId?: string;
  unitPrice?: HclDisplayPriceUnitPrice[];
  userDataField?: { value?: string; key: string }[];
}

/** Top-level response from GET /wcs/resources/store/{storeId}/display_price */
export interface HclDisplayPriceResponse {
  resourceId?: string;
  resourceName?: string;
  resultList?: HclDisplayPriceItem[];
}

/**
 * A single unit price entry in a /price?q=byPartNumbers response item.
 * Note: HCL uses `UnitPrice` (capital U) on this endpoint.
 */
export interface HclEntitledPriceUnitPrice {
  price?: {
    currency?: string;
    /** Numeric value. */
    value?: number;
  };
  quantity?: { value?: number; uom?: string };
}

/**
 * A single item in the `EntitledPrice` array of a /price?q=byPartNumbers response.
 */
export interface HclEntitledPriceItem {
  partNumber?: string;
  productId?: string;
  contractId?: string;
  UnitPrice?: HclEntitledPriceUnitPrice[];
}

/** Top-level response from GET /wcs/resources/store/{storeId}/price?q=byPartNumbers */
export interface HclEntitledPriceResponse {
  resourceId?: string;
  resourceName?: string;
  EntitledPrice?: HclEntitledPriceItem[];
}

/**
 * A single item in the `InventoryAvailability` array of the inventoryavailability response.
 */
export interface HclInventoryAvailabilityItem {
  /** Internal HCL product ID (numeric string). */
  productId?: string;
  /** Inventory status string, e.g. 'Available'. */
  inventoryStatus?: string;
  /** Available quantity as a string (format: double). */
  availableQuantity?: string;
  unitOfMeasure?: string;
  /** ID of the physical store, if this is a store-specific record. */
  physicalStoreId?: string;
  /** Name/key of the physical store, e.g. '1004/0001'. */
  physicalStoreName?: string;
  /** Name/key of the online store. Present on online inventory records. */
  onlineStoreName?: string;
  /** Online store ID. Present on online inventory records. */
  onlineStoreId?: string;
  availabilityDateTime?: string;
  x_customField1?: string | null;
  x_customField2?: string | null;
  x_customField3?: string | null;
  userDataField?: { value?: string; key: string }[];
}

/** Top-level response from GET /wcs/resources/store/{storeId}/inventoryavailability/byPartNumber/{partNumbers} */
export interface HclInventoryAvailabilityResponse {
  resourceId: string;
  resourceName: string;
  InventoryAvailability?: HclInventoryAvailabilityItem[];
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
  merchandisingAssociations?: HclAssociation[];
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

// ---------------------------------------------------------------------------
// WCS Transaction Service — Identity / Session types
// ---------------------------------------------------------------------------

/**
 * Response from POST /wcs/resources/store/{storeId}/guestidentity
 * and POST /wcs/resources/store/{storeId}/loginidentity.
 */
export interface HclWcsIdentityResponse {
  /** Opaque session token — must be forwarded as `WCToken` header on subsequent requests. */
  WCToken: string;
  /** Trusted token — must be forwarded as `WCTrustedToken` header. */
  WCTrustedToken: string;
  /** Numeric user ID string assigned by WCS. */
  userId: string;
  /** Personalization tracking ID. */
  personalizationID?: string;
  resourceName?: string;
}

/**
 * A single entry in a WCS person address book (contact list).
 * Returned as part of the GET /person/@self response (contact[] field)
 * and used for POST/PUT /person/@self/contact operations.
 */
export interface HclWcsPersonContact {
  /** Unique identifier / display name for this address (e.g. 'Home', 'Work', 'Billing'). */
  nickName: string;
  firstName?: string;
  lastName?: string;
  /** Street address lines. Index 0 = street, index 1 = apartment / second line. */
  addressLine?: string[];
  /** Alternative single-field address (some WCS endpoint variants). */
  address1?: string;
  city?: string;
  stateOrProvinceName?: string;
  zipCode?: string;
  /** ISO country code, e.g. 'US'. */
  country?: string;
  phone1?: string;
  email1?: string;
  /** '1' marks this as the default / primary shipping address. */
  primary?: string;
  addressType?: string;
}

/**
 * Response from GET /wcs/resources/store/{storeId}/person/@self.
 * Only the fields we use are typed; the full WCS schema has many more.
 */
export interface HclPersonResponse {
  /** Numeric user ID string. */
  userId: string;
  /** Customer's email / logon ID. Only populated for registered users. */
  logonId?: string;
  email1?: string;
  firstName?: string;
  lastName?: string;
  phone1?: string;
  resourceName?: string;
  /** Organization ID. `-2000` indicates the default anonymous org. */
  orgizationId?: string;
  /** Address book entries embedded in the person/@self response. */
  contact?: HclWcsPersonContact[];
}

// ---------------------------------------------------------------------------
// WCS Transaction Service — Cart / Order types
// ---------------------------------------------------------------------------

/** A single order item embedded in a WCS cart/@self response. */
export interface HclWcsOrderItem {
  orderItemId: string;
  /** Internal HCL catalog entry ID (numeric string). */
  productId?: string;
  /** SKU part number. Use this as the variant identifier. */
  partNumber: string;
  /** Quantity as a string — coerce with Number(). */
  quantity: string;
  /** Total line price as a string (unitPrice × quantity). */
  orderItemPrice: string;
  /** Price per single unit as a string. */
  unitPrice: string;
  /** ISO 4217 currency code. */
  currency: string;
  orderItemInventoryStatus?: string;
  /** 'true' | 'false' — marks free-gift promotional items. */
  freeGift?: string;
  comments?: string;
  /** Ship mode ID assigned to this item (present in shipping_info response). */
  shipModeId?: string;
  shipModeCode?: string;
  shipModeDescription?: string;
  carrier?: string;
  shippingCharge?: string;
}

/** A single price adjustment on a WCS cart (discount, surcharge, tax, shipping). */
export interface HclWcsAdjustment {
  code: string;
  /** Adjustment amount as a string — negative for discounts. */
  amount: string;
  currency: string;
  /** 'Order' | 'OrderItem' | 'Shipping' */
  displayLevel?: string;
  /** 'Discount' | 'Tax' | 'Surcharge' | 'Shipping' */
  usage?: string;
  description?: string;
}

/** A promotion/coupon code applied to a WCS cart. */
export interface HclWcsPromoCode {
  code: string;
  reason?: string;
  associatedPromotion?: { promotionId?: string; promotionCode?: string }[];
}

/** Key-value pair carried in a WCS payment instruction. */
export interface HclWcsPaymentProtocolData {
  name: string;
  value: string;
}

/** A payment instruction attached to a WCS cart. */
export interface HclWcsPaymentInstruction {
  piId: string;
  payMethodId: string;
  /** Authorized amount as a string. */
  piAmount?: string;
  currency?: string;
  protocolData?: HclWcsPaymentProtocolData[];
  piStatus?: string;
  piDescription?: string;
}

/** An address embedded in a WCS cart/order response. */
export interface HclWcsAddress {
  addressId?: string;
  firstName?: string;
  lastName?: string;
  /** Array of street address lines — index 0 is the primary line. */
  addressLine?: string[];
  /** Single-field street address (some WCS endpoints prefer this over addressLine). */
  address1?: string;
  city?: string;
  /** State/province/region code. */
  state?: string;
  zipCode?: string;
  country?: string;
  phone1?: string;
  email1?: string;
  addressType?: string;
  nickName?: string;
}

/** A single available ship mode returned by the WCS shipping_info endpoint. */
export interface HclWcsShipMode {
  shipModeId: string;
  carrier: string;
  shipModeCode: string;
  shipModeDescription: string;
  /** Store-defined extra field (varies by HCL configuration). */
  field1?: string;
  /** Estimated delivery time (store-defined). */
  field2?: string;
}

/**
 * Top-level response from GET /wcs/resources/store/{storeId}/cart/@self.
 * All monetary amounts are returned as strings and must be parsed with Number().
 */
export interface HclWcsCartResponse {
  orderId: string;
  storeId?: string;
  buyerId?: string;
  orgUniqueID?: string;
  grandTotal?: string;
  grandTotalCurrency?: string;
  totalProductPrice?: string;
  totalProductPriceCurrency?: string;
  totalShippingCharge?: string;
  totalShippingChargeCurrency?: string;
  totalAdjustment?: string;
  totalAdjustmentCurrency?: string;
  totalSalesTax?: string;
  totalSalesTaxCurrency?: string;
  totalShippingTax?: string;
  /** Shipping address embedded in the cart (when set). */
  x_shippingAddress?: HclWcsAddress;
  /** Billing address embedded in the cart (when set). */
  x_billingAddress?: HclWcsAddress;
  orderItem?: HclWcsOrderItem[];
  adjustment?: HclWcsAdjustment[];
  promotionCode?: HclWcsPromoCode[];
  paymentInstruction?: HclWcsPaymentInstruction[];
  /** Currently selected shipping mode ID. */
  shipModeId?: string;
  shipModeCode?: string;
  shipModeDescription?: string;
  carrier?: string;
  /** '0' | '1' — locked orders cannot be modified. */
  x_isPurchaseLocked?: string;
  /** WCS order status, e.g. 'P' = pending, 'C' = submitted. */
  orderStatus?: string;
  lastUpdateDate?: string;
  /** Order description / name as persisted in WCS. Returned by GET /order/{orderId} and GET /order/byStatus/P. */
  orderDescription?: string;
}

/**
 * Response from GET /store/{storeId}/order/byStatus/P.
 * Returns a list of pending orders (multi-cart B2B support).
 */
export interface HclWcsOrderListResponse {
  Order: HclWcsCartResponse[];
  recordSetTotal?: string;
  recordSetCount?: string;
  recordSetComplete?: string;
  recordSetStartNumber?: string;
}

/** Response from the precheckout / checkout endpoints. */
export interface HclWcsOrderIdContainer {
  orderId: string;
  resourceName?: string;
}

/** Response from GET cart/@self/shipping_info with usable shipping modes. */
export interface HclWcsShipModesResponse {
  /** Present in newer WCS versions when using IBM_usableShippingMode profile. */
  usableShippingMode?: HclWcsShipMode[];
  /** Present in older WCS versions — shipping mode embedded per orderItem. */
  orderItem?: Array<{
    orderItemId: string;
    shipModeId?: string;
    shipModeCode?: string;
    shipModeDescription?: string;
    carrier?: string;
    description?: string;
  }>;
}

/** A single usable payment method entry returned by WCS. */
export interface HclWcsPaymentMethod {
  paymentMethodName: string;
  xucc?: string;
  description?: string;
}

/** Response listing available payment methods for the store. */
export interface HclWcsPaymentMethodsResponse {
  usablePaymentInformation?: HclWcsPaymentMethod[];
}

/** Minimal response from addOrderItem / updateOrderItem operations. */
export interface HclWcsOrderItemUpdateResponse {
  orderId: string;
  orderItem?: { orderItemId: string }[];
}

/** Response from POST /store/{storeId}/cart/create_order */
export interface HclWcsCreateOrderResponse {
  /** The newly created order ID. */
  outOrderId: string;
  redirecturl?: string;
  viewTaskName?: string;
}

/**
 * A full order as returned by GET /wcs/resources/store/{storeId}/order/{orderId}.
 * Extends the cart response shape with the `placedDate` field that is only
 * present on placed (non-active) orders.
 */
export interface HclWcsOrderDetailResponse extends HclWcsCartResponse {
  /** Date/time when the order was placed, e.g. '2024-01-15T10:30:00.000Z'. */
  placedDate?: string;
}

/**
 * A single summary entry in a GET /wcs/resources/store/{storeId}/order/@history response.
 * Contains only the fields available in the history list; use getById for full detail.
 */
export interface HclWcsOrderHistoryItem {
  orderId: string;
  /** WCS order status code, e.g. 'P', 'M', 'S', 'X'. */
  status: string;
  placedDate?: string;
  grandTotal?: string;
  grandTotalCurrency?: string;
  totalProductPrice?: string;
  orderDescription?: string;
  buyerDistinguishedName?: string;
}

/**
 * Top-level response from GET /wcs/resources/store/{storeId}/order/@history.
 * Returns a paginated list of the buyer's past orders.
 */
export interface HclWcsOrderHistoryResponse {
  Order?: HclWcsOrderHistoryItem[];
  recordSetTotal?: string;
  recordSetCount?: string;
  recordSetStartNumber?: string;
  recordSetComplete?: string;
}

// ---------------------------------------------------------------------------
// Query Service — Merchandising Associations
// ---------------------------------------------------------------------------

/**
 * A product item returned within a `merchandisingAssociations` array on a
 * HCL detail-profile product response. Extends the search item shape with
 * an `associationCodeType` that identifies the semantic relationship.
 *
 * Known values: 'ACCESSORY', 'SPAREPART', 'REPLACEMENT', 'CROSSSELL', 'UPSELL', 'UPGRADE'
 */
export interface HclAssociation extends HclProductSearchItem {
  /** The association type code. e.g. 'ACCESSORY', 'SPAREPART', 'REPLACEMENT'. */
  associationCodeType?: string;
  /** Display sequence for ordering associations within a type. */
  associationSequence?: string;
}

// ---------------------------------------------------------------------------
// WCS Transaction Service — Marketing / ESpot
// ---------------------------------------------------------------------------

/**
 * A single activity data entry within a marketing spot response.
 * When `baseMarketingSpotDataType` is 'CatalogEntry' or 'CatalogEntryId',
 * the entry represents a product recommendation from the spot.
 */
export interface HclEspotActivityData {
  /** 'CatalogEntry' | 'CatalogEntryId' | 'CatalogGroupId' | 'MarketingContent' */
  baseMarketingSpotDataType?: string;
  /** Internal HCL product uniqueID (numeric string). Present for CatalogEntry/CatalogEntryId types. */
  contentId?: string;
  /** Part number of the product, if returned inline by the spot configuration. */
  partNumber?: string;
  /** Display name of the product or content entry. */
  contentName?: string;
}

/** A single marketing spot entry in a WCS espot response. */
export interface HclEspotMarketingSpot {
  eSpotName?: string;
  baseMarketingSpotActivityData?: HclEspotActivityData[];
}

/** Top-level response from GET /wcs/resources/store/{storeId}/espot/{name}. */
export interface HclEspotResponse {
  MarketingSpotData?: HclEspotMarketingSpot[];
}

// ---------------------------------------------------------------------------
// WCS Transaction Service — Segment / Personalization
// ---------------------------------------------------------------------------

/** A single customer segment (member group) entry in a WCS segment response. */
export interface HclSegmentMemberGroup {
  id: string;
  displayName?: { language: number; value: string };
  description?: { language: number; value: string };
  usage?: string[];
}

/** Top-level response from GET /wcs/resources/store/{storeId}/segment. */
export interface HclSegmentResponse {
  MemberGroup?: HclSegmentMemberGroup[];
  recordSetTotal?: number;
  recordSetCount?: number;
  recordSetStartNumber?: number;
  recordSetComplete?: boolean;
}

// ---------------------------------------------------------------------------
// WCS Transaction Service — Organization (B2B Company)
// ---------------------------------------------------------------------------

/**
 * A WCS person contact embedded within an organization's contactInfo or addressBook.
 * Shares the same shape as HclWcsPersonContact but is returned under different keys
 * in the organization API response.
 */
export interface HclWcsOrgContact {
  nickName?: string;
  firstName?: string;
  lastName?: string;
  /** Street address lines. Index 0 = street, index 1 = second line. */
  addressLine?: string[];
  city?: string;
  stateOrProvinceName?: string;
  zipCode?: string;
  country?: string;
  phone1?: string;
  email1?: string;
  /** '1' marks this as the default / primary shipping address. */
  primary?: string;
  addressType?: string;
  addressId?: string;
}

/**
 * An organization entry as returned by GET /wcs/resources/store/{storeId}/organization/{id}.
 * Fields present depend on the profileName used (IBM_Org_Entity_Details vs IBM_Organization_Details).
 */
export interface HclOrganizationItem {
  /** Internal WCS organization/member ID (numeric string). */
  organizationId?: string;
  orgEntityId?: string;
  organizationName?: string;
  displayName?: string;
  /** Approval status code: '0' = pending, '1' = approved, '2' = rejected. */
  status?: string;
  /** '0' = locked/blocked, '1' = active. */
  state?: string;
  /** Tax payer ID (maps to taxIdentifier on the domain model). */
  taxPayerId?: string;
  /** Legal entity identifier. */
  legalId?: string;
  /** Business category. */
  businessCategory?: string;
  description?: string;
  /** Primary billing / contact address. */
  contactInfo?: HclWcsOrgContact;
  /** Additional shipping addresses. */
  addressBook?: HclWcsOrgContact[];
  /** Context attributes set by IBM_Org_Entity_Details profile (key-value map). */
  contextAttribute?: Record<string, unknown>;
  /** Parent organization member ID. */
  parentMemberId?: string;
}

/**
 * Top-level response from GET /wcs/resources/store/{storeId}/organization
 * with profileName=IBM_Organization_List_Summary.
 */
export interface HclOrganizationListResponse {
  organizationDataBeans?: HclOrganizationItem[];
  recordSetTotal?: string;
  recordSetCount?: string;
  recordSetStartNumber?: string;
  recordSetComplete?: string;
}

/**
 * Response from POST /wcs/resources/store/{storeId}/organization/buyer.
 * Returns the newly created org entity ID and the buyer admin user ID.
 */
export interface HclBuyerRegistrationResponse {
  orgEntityId: string;
  userId: string;
  resourceName?: string;
}

// ---------------------------------------------------------------------------
// WCS Transaction Service — Store Locator
// ---------------------------------------------------------------------------

/** A single store attribute as returned in the storelocator response. */
export interface HclStoreAttribute {
  name: string;
  value: string;
  displayName?: string;
  displayValue?: string;
}

/** A description block for a physical store. */
export interface HclStoreDescription {
  displayStoreName?: string;
}

/**
 * A single physical store entry as returned by the WCS storelocator endpoints.
 * Reference: location_based_services.yaml — storelocator-storelocator_item
 */
export interface HclPhysicalStore {
  uniqueID: string;
  /** Store name as configured in WCS (fallback when Description[].displayStoreName is absent). */
  storeName?: string;
  /** Array of description blocks; index 0 typically contains displayStoreName. */
  Description?: HclStoreDescription[];
  /** Street address lines. Index 0 = primary line, index 1 = second line. */
  addressLine?: string[];
  city?: string;
  stateOrProvinceName?: string;
  postalCode?: string;
  country?: string;
  telephone1?: string;
  email?: string;
  /** Geographic latitude (as a string — coerce with Number()). */
  latitude?: string;
  /** Geographic longitude (as a string — coerce with Number()). */
  longitude?: string;
  /** Distance from the query point (as a string — coerce with Number()). */
  distance?: string;
  Attribute?: HclStoreAttribute[];
  userDataField?: { value?: string; key: string }[];
}

/**
 * Top-level response from GET /wcs/resources/store/{storeId}/storelocator/latitude/{lat}/longitude/{lon}.
 */
export interface HclStoreLocatorResponse {
  PhysicalStore?: HclPhysicalStore[];
  recordSetTotal?: string;
  recordSetCount?: string;
  recordSetStartNumber?: string;
  recordSetComplete?: string;
}

// ---------------------------------------------------------------------------
// WCS Transaction Service — Wishlist (Product List)
// ---------------------------------------------------------------------------

/**
 * A single item entry within a wishlist — from GET /wishlist/{id}/item.
 */
export interface HclWishlistItem {
  /** Unique identifier for the wishlist item entry. */
  giftListItemID?: string;
  /** Internal WCS catalog entry ID (numeric string). Corresponds to a SKU. */
  productId?: string;
  /** SKU part number — use this as the variant identifier when present. */
  partNumber?: string;
  /** Requested quantity as a string — coerce with Number(). */
  quantityRequested?: string;
  /** Purchased quantity as a string. */
  quantityBought?: string;
  location?: string;
}

/**
 * A single wishlist (GiftList) entry as returned by GET /wishlist/@self.
 */
export interface HclWishlist {
  /** Internal WCS list ID. */
  uniqueID?: string;
  /** Customer-assigned external identifier. Alias for uniqueID on some responses. */
  externalIdentifier?: string;
  /** The list's display name. */
  descriptionName?: string;
  /** The list's optional description text. */
  description?: string;
  lastUpdate?: string;
  guestAccessKey?: string;
  /** Items embedded in the list (present when fetching a specific list with items). */
  item?: HclWishlistItem[];
}

/** Top-level response from GET /wcs/resources/store/{storeId}/wishlist/@self. */
export interface HclWishlistListResponse {
  GiftList?: HclWishlist[];
  recordSetTotal?: string;
  recordSetCount?: string;
  recordSetStartNumber?: string;
  recordSetComplete?: string;
}

/** Top-level response from GET /wcs/resources/store/{storeId}/wishlist/{id}/item. */
export interface HclWishlistItemResponse {
  GiftList?: HclWishlist[];
  recordSetTotal?: string;
  recordSetCount?: string;
  recordSetStartNumber?: string;
}

/** Response from POST /wishlist (create) and PUT /wishlist/{id} (update). */
export interface HclWishlistMutationResponse {
  uniqueID?: string;
  externalIdentifier?: string;
  resourceName?: string;
}

// ---------------------------------------------------------------------------
// Requisition list (B2B) types
// ---------------------------------------------------------------------------

/** A single item in a WCS requisition list. */
export interface HclRequisitionListItem {
  /** Unique identifier of the item within the list. */
  requisitionListItemId?: string;
  /** Numeric product identifier (same semantics as GiftList item.productId). */
  productId?: string;
  /** Partner number / SKU. */
  partNumber?: string;
  /** Requested quantity as a string. */
  quantity?: string;
  /** Location (e.g. "online"). */
  location?: string;
}

/** A single WCS requisition list (from GET /requisitionList/@self or by ID). */
export interface HclRequisitionList {
  /** Unique identifier of the list. */
  requisitionListId?: string;
  /** Display name of the list. */
  name?: string;
  /** Description of the list. */
  description?: string;
  /** Items in the list (only present on detail endpoints). */
  item?: HclRequisitionListItem[];
}

/** Response from GET /requisitionList/@self — array of lists. */
export interface HclRequisitionListResponse {
  resultList?: HclRequisitionList[];
  recordSetTotal?: string;
  recordSetCount?: string;
  recordSetStartNumber?: string;
}

/** Response from GET /requisitionList/{id}/item. */
export interface HclRequisitionListDetailResponse {
  resultList?: HclRequisitionList[];
  recordSetTotal?: string;
}

/** Response from POST /requisitionList (create) and PUT /requisitionList/{id}. */
export interface HclRequisitionListMutationResponse {
  requisitionListId?: string;
  resourceName?: string;
}
