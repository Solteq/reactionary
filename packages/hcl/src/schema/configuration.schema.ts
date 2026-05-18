import * as z from 'zod';

/**
 * HCL Commerce uses "profiles" to control what data is returned by the Query
 * Service. The right profile depends on your server configuration and any
 * custom profiles deployed to the instance.
 *
 * HCL ships a set of built-in profiles (prefixed HCL_V2_*). Product detail
 * profiles are always instance-specific — set them via environment variables.
 *
 * Env vars:
 *   HCL_PROFILE_PRODUCT            — profile for getById / getBySlug / getBySKU
 *   HCL_PROFILE_PRODUCT_SEARCH     — profile for search by term (default: HCL_V2_findProductsBySearchTermWithPrice)
 *   HCL_PROFILE_CATEGORY_BROWSE    — profile for category browse / findChildCategories / findTopCategories
 */
const HclProfilesSchema = z
  .looseObject({
    product: z.string().default('HCL_V2_findProductByPartNumber_Details').meta({
      description:
        'Profile name for product detail lookups (getById, getBySlug, getBySKU).',
    }),
    productSearch: z
      .string()
      .default('HCL_V2_findProductsBySearchTermWithPrice')
      .meta({ description: 'Profile name for product search by term.' }),
    categoryBrowse: z
      .string()
      .default('HCL_V2_findProductsByCategoryWithPriceRange')
      .meta({
        description: 'Profile name for product search filtered by category.',
      }),
  })
  .default(() => ({
    product: 'HCL_V2_findProductByPartNumber_Details',
    productSearch: 'HCL_V2_findProductsBySearchTermWithPrice',
    categoryBrowse: 'HCL_V2_findProductsByCategoryWithPriceRange',
  }));

export const HclConfigurationSchema = z.looseObject({
  apiUrl: z.string().meta({
    description:
      'The base origin URL for the HCL Commerce server (e.g. https://example.com).',
  }),
  storeId: z
    .string()
    .meta({ description: 'The HCL Commerce store identifier.' }),
  catalogId: z
    .string()
    .optional()
    .meta({ description: 'The HCL Commerce catalog identifier.' }),
  /**
   * Maps BCP 47 locale strings (from RequestContext) to HCL Commerce langId values.
   * HCL uses numeric language identifiers (e.g. -1 for English, -11 for Finnish).
   * Add an entry for each locale your store supports.
   */
  localeMap: z.record(z.string(), z.string()).default({ 'en-US': '-1' }).meta({
    description:
      'Mapping from BCP 47 locale (RequestContext.languageContext.locale) to HCL langId.',
  }),
  profiles: HclProfilesSchema,
});

export type HclConfiguration = z.infer<typeof HclConfigurationSchema>;
