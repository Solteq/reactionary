import * as z from 'zod';

/**
 * HCL Commerce uses "profiles" to control what data is returned by the Query
 * Service. The right profile depends on your server configuration and any
 * custom profiles deployed to the instance.
 *
 * HCL ships a set of built-in profiles (prefixed HCL_V2_*). Override the
 * defaults here if your instance uses custom profiles.
 */
const HclProfilesSchema = z
  .looseObject({
    product: z.string().default('HCL_V2_findProductByPartNumber_Details').meta({
      description:
        'Profile name for product detail lookups ( getBySlug, getBySKU).',
    }),
    productById: z.string().default('HCL_V2_findProductByIds_Details').meta({
      description: 'Profile name for product detail lookups (getById).',
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
    productById: 'HCL_V2_findProductByIds_Details',
    productSearch: 'HCL_V2_findProductsBySearchTermWithPrice',
    categoryBrowse: 'HCL_V2_findProductsByCategoryWithPriceRange',
  }));

export const HclConfigurationSchema = z.looseObject({
  apiUrl: z.string().meta({
    description:
      'The base origin URL for the HCL Commerce server (e.g. https://example.com).',
  }),
  searchApiUrl: z.string().optional().meta({
    description:
      'The base origin URL for the HCL Commerce Search API server, if different from apiUrl.',
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
  /**
   * Optional price rule ID passed to /display_price?q=byPartNumbersAndPriceRuleId.
   * When omitted the server applies its default configured price rule.
   * In Karkkainen this is '10003'.
   */
  priceRuleId: z.string().optional().meta({
    description:
      'Price rule ID for /display_price WCS calls. Optional — the server uses its default rule when absent.',
  }),
  /**
   * Maps Reactionary association types to the HCL `associationCodeType` values
   * returned in `merchandisingAssociations` on product detail responses.
   * Override to match custom HCL store configuration.
   */
  associationTypes: z
    .looseObject({
      accessories: z.array(z.string()).default(['ACCESSORY']),
      spareparts: z.array(z.string()).default(['SPAREPART']),
      replacements: z.array(z.string()).default(['REPLACEMENT']),
    })
    .default(() => ({
      accessories: ['ACCESSORY'],
      spareparts: ['SPAREPART'],
      replacements: ['REPLACEMENT'],
    })),
  /**
   * Names of HCL marketing spots used for product recommendation algorithms.
   * Each algorithm calls the corresponding named espot via the WCS Transaction Service.
   * These espots must be configured in HCL Commerce to return catalog entry data.
   */
  espotNames: z
    .looseObject({
      frequentlyBoughtTogether: z
        .string()
        .default('Reactionary_FrequentlyBoughtTogether'),
      similar: z.string().default('Reactionary_SimilarProducts'),
      related: z.string().default('Reactionary_RelatedProducts'),
      trendingInCategory: z.string().default('Reactionary_TrendingInCategory'),
      popular: z.string().default('Reactionary_Popular'),
      topPicks: z.string().default('Reactionary_TopPicks'),
      alsoViewed: z.string().default('Reactionary_AlsoViewed'),
    })
    .default(() => ({
      frequentlyBoughtTogether: 'Reactionary_FrequentlyBoughtTogether',
      similar: 'Reactionary_SimilarProducts',
      related: 'Reactionary_RelatedProducts',
      trendingInCategory: 'Reactionary_TrendingInCategory',
      popular: 'Reactionary_Popular',
      topPicks: 'Reactionary_TopPicks',
      alsoViewed: 'Reactionary_AlsoViewed',
    })),
});

export type HclConfiguration = z.infer<typeof HclConfigurationSchema>;
