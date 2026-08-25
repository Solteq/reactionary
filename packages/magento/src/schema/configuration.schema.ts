import * as z from 'zod';

const MagentoConfigurationFieldsSchema = z.looseObject({
  adminApiKey: z.string().meta({ description: 'The API key for Magento admin operations. Needed for the few tasks that require admin access.' }),
  baseUrl: z.string().meta({ description: 'The base URL for the Magento installation.' }),
  mediaUrl: z.string().optional().meta({ description: 'The base URL for media files. If not provided, it will be derived from the baseUrl.' }),
  mediaSource: z.enum(['EXTERNAL', 'DEFAULT']).default('DEFAULT').meta({ description: 'Where product imagery is taken from. DEFAULT uses the Magento media gallery. EXTERNAL uses the `original_dam_reference` attribute, which holds the PIM-sorted list of DAM image URLs.' }),
  defaultCurrency: z.string().default(''),
  rootCategoryId: z.string().default('2').meta({ description: 'The ID of the root category in Magento. Typically "2" for the default Magento setup.' }),
  allCurrencies: z.array(z.string()),
  graphqlUrl: z.string().optional().meta({ description: 'The GraphQL endpoint. Defaults to `{baseUrl}/graphql`. Reviews and ratings have no REST equivalent in Magento, so the product reviews capability goes through GraphQL.' }),
  reviewRatingCode: z.string().optional().meta({ description: 'The name of the Magento review rating (as listed by `productReviewRatingsMetadata`) that carries the overall star rating. Defaults to "Rating"; the first available rating is used as a fallback.' }),
  storeBaseCode: z.string().default('').meta({ description: 'The base store code for the catalog scope. Store views are provisioned per language as `{storeBaseCode}-{language}`, so a `b2c` base serves a `da-DK` request from the `b2c-da` store view. Requests without a usable locale fall back to the bare base code.' }),
  storeCode: z.string().optional().meta({ deprecated: true, description: 'Deprecated: renamed to `storeBaseCode`. Still accepted, and folded into `storeBaseCode` when that is not set.' }),
  authStoreCode: z.string().default('default').meta({ description: 'The store/website scope used for customer authentication and account operations (token, customers/me). Customers typically live on the default website, which may differ from the catalog storeBaseCode. This scope is never suffixed with the request locale.' }),
});

/**
 * Accepts the deprecated `storeCode` alias and normalizes it into
 * `storeBaseCode`, mirroring the resolved value back onto `storeCode` so
 * existing consumers reading it keep working.
 */
export const MagentoConfigurationSchema = MagentoConfigurationFieldsSchema.transform(
  (config): MagentoConfiguration => {
    const storeBaseCode = config.storeBaseCode || config.storeCode || '';
    return { ...config, storeBaseCode, storeCode: storeBaseCode };
  },
);

/**
 * The configuration as callers write it: either `storeBaseCode` or the
 * deprecated `storeCode` may be supplied.
 */
export type MagentoConfigurationInput = z.input<typeof MagentoConfigurationFieldsSchema>;

/**
 * The parsed configuration handed to the client, capabilities and factories.
 * `storeBaseCode` is always populated once parsed.
 */
export type MagentoConfiguration = z.output<typeof MagentoConfigurationFieldsSchema>;
