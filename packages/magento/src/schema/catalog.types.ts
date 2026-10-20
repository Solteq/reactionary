import * as z from 'zod';
import type {
  MagentoCategory,
  MagentoConfigurableProductOption,
  MagentoProduct,
  MagentoProductSearchResult,
} from './magento.types.js';

/**
 * Magento renders EAV flags inconsistently across endpoints and versions:
 * `"1"`, `1` and `true` all mean "on".
 */
const MagentoFlagSchema = z
  .union([z.boolean(), z.string(), z.number(), z.null()])
  .optional()
  .transform((value) => value === true || value === 1 || value === '1');

const MagentoScalarSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value));

/** One option of a select/multiselect/boolean attribute as REST returns it. */
export const MagentoRestAttributeOptionSchema = z.looseObject({
  label: z.union([z.string(), z.number(), z.null()]).optional(),
  value: z.union([z.string(), z.number(), z.null()]).optional(),
});

/**
 * A product attribute as returned by `/V1/products/attribute-sets/{id}/attributes`
 * (`Magento\Catalog\Api\Data\ProductAttributeInterface`).
 */
export const MagentoRestProductAttributeSchema = z.looseObject({
  attribute_id: z.union([z.string(), z.number()]).optional(),
  attribute_code: z.string(),
  frontend_input: z.string().nullable().optional(),
  default_frontend_label: z.string().nullable().optional(),
  is_visible_on_front: MagentoFlagSchema,
  is_user_defined: MagentoFlagSchema,
  is_filterable: MagentoFlagSchema,
  options: z.array(MagentoRestAttributeOptionSchema).nullable().optional(),
});

export const MagentoRestProductAttributeListSchema = z.array(MagentoRestProductAttributeSchema);
export const MagentoRestAttributeOptionListSchema = z.array(MagentoRestAttributeOptionSchema);

export type MagentoRestProductAttribute = z.output<typeof MagentoRestProductAttributeSchema>;
export type MagentoRestAttributeOption = z.output<typeof MagentoRestAttributeOptionSchema>;

/** A normalized attribute option: the stored value (an option id) and its store label. */
export const MagentoAttributeOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

/**
 * Normalized, cacheable product attribute metadata. `options` is empty for
 * attributes that are not option based (text, price, date, ...).
 */
export const MagentoAttributeMetadataSchema = z.object({
  attributeId: z.string(),
  code: z.string(),
  label: z.string(),
  frontendInput: z.string(),
  visibleOnFront: z.boolean(),
  userDefined: z.boolean(),
  options: z.array(MagentoAttributeOptionSchema),
});

/**
 * The attribute metadata available for a product. `complete` is true when the
 * metadata of the product's whole attribute set was loaded, and false when only
 * a best-effort subset (e.g. brand/manufacturer options) could be read.
 */
export const MagentoAttributeCatalogSchema = z.object({
  complete: z.boolean(),
  attributes: z.array(MagentoAttributeMetadataSchema),
});

export type MagentoAttributeOption = z.output<typeof MagentoAttributeOptionSchema>;
export type MagentoAttributeMetadata = z.output<typeof MagentoAttributeMetadataSchema>;
export type MagentoAttributeCatalog = z.output<typeof MagentoAttributeCatalogSchema>;

/** Cache envelope for single-string cache entries (the cache stores objects). */
export const MagentoCachedKeySchema = z.object({ value: z.string() });

/**
 * Everything the product factory needs to map a Magento product: the product
 * itself plus the data that has to be fetched separately over REST.
 */
export interface MagentoProductDetails {
  product: MagentoProduct;
  /** Enabled simple children of a configurable product. */
  children?: MagentoProduct[];
  /** `/V1/configurable-products/{sku}/options/all` of a configurable product. */
  configurableOptions?: MagentoConfigurableProductOption[];
  /** Attribute metadata used for labels and storefront visibility. */
  attributes?: MagentoAttributeCatalog;
  /** Category entity id → category key (external_id) for `parentCategories`. */
  categoryKeys?: Record<string, string>;
  /** When set, this SKU (a child of a configurable) becomes the main variant. */
  preferredSku?: string;
}

/**
 * A Magento category with its parent already translated to the category key
 * Reactionary uses (the `external_id`, falling back to the entity id).
 * `parentKey` is null for top-level categories (children of the store root).
 */
export interface MagentoResolvedCategory extends MagentoCategory {
  parentKey?: string | null;
}

/** A facet bucket as returned by the GraphQL `products { aggregations }` field. */
export const MagentoAggregationOptionSchema = z.looseObject({
  label: z.string().nullable().optional(),
  value: MagentoScalarSchema,
  count: z.number().nullable().optional(),
});

export const MagentoAggregationSchema = z.looseObject({
  attribute_code: z.string(),
  label: z.string().nullable().optional(),
  count: z.number().nullable().optional(),
  options: z.array(MagentoAggregationOptionSchema).nullable().optional(),
});

export const MagentoProductAggregationsResponseSchema = z.looseObject({
  products: z
    .looseObject({
      aggregations: z.array(MagentoAggregationSchema).nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type MagentoAggregationOption = z.output<typeof MagentoAggregationOptionSchema>;
export type MagentoAggregation = z.output<typeof MagentoAggregationSchema>;

/**
 * What the product search factory maps: the REST search page plus the
 * GraphQL facet aggregations and the category id → key translation the
 * category facet needs.
 */
export interface MagentoProductSearchDetails {
  result: MagentoProductSearchResult;
  aggregations?: MagentoAggregation[];
  /** Category entity id → category key (external_id). */
  categoryKeys?: Record<string, string>;
}
