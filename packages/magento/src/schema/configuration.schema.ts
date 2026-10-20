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
  checkoutAgreementIds: z.array(z.string()).optional().meta({ description: 'Ids of the Magento terms and conditions (Magento_CheckoutAgreements) the shopper accepts when placing an order. Required by stores with "Enable Terms and Conditions" on, which otherwise reject order placement. Sent as the payment method\'s `extension_attributes.agreement_ids`. The storefront must collect the shopper\'s consent before finalizing checkout.' }),
  checkoutTelephoneFallback: z.string().optional().meta({ description: 'The telephone sent on checkout addresses when the shopper gave no phone number (`notificationPhone`). Magento requires a telephone on quote addresses by default (Stores > Configuration > Customers > Customer Configuration > Name and Address Options > Show Telephone = Required), so a placeholder is needed there. Defaults to "000". Set it to an empty string on stores where the telephone is optional, to send none.' }),
  addressNicknameAttribute: z.string().optional().meta({ description: 'Code of a customer-address custom attribute (EAV, text) that stores the reactionary address nickname. Magento has no native address label, so when this is not set the nickname is kept in the address `company` field.' }),
  companyRoleMapping: z.looseObject({
    manager: z.string().optional().meta({ description: 'Id (uid, e.g. "Mg==") or name of the Magento company role that maps to the core "manager" role.' }),
    employee: z.string().optional().meta({ description: 'Id (uid) or name of the Magento company role that maps to the core "employee" role, and that is assigned when a role is unassigned.' }),
  }).optional().meta({ description: 'Adobe Commerce B2B: maps the core employee roles onto the company\'s Magento roles. The company administrator is always the core "admin". Users whose Magento role matches `manager` are "manager"; every other user is "employee". Assigning a role (and inviting with one) requires the corresponding entry.' }),
  companyUserDefaults: z.looseObject({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    jobTitle: z.string().optional(),
    telephone: z.string().optional(),
  }).optional().meta({ description: 'Adobe Commerce B2B: placeholders for the fields `createCompanyUser` requires but the core invitation does not carry. Defaults: first name = local part of the email, last name / job title / telephone = "N/A".' }),
  storeLocationsCacheTtlSeconds: z.number().optional().meta({ description: 'How long (seconds) the full list of MSI pickup locations is cached for store proximity searches. Defaults to 300.' }),
  personalizationResolveGroupCodes: z.boolean().optional().meta({ description: 'When true, the personalization profile resolves the customer group code (e.g. "Wholesale") with an admin REST call to `/V1/customerGroups/{id}`, using the group id Magento reports for the shopper. Otherwise groups are reported by numeric id. Defaults to false.' }),
  personalizationIncludeSegments: z.boolean().optional().meta({ description: 'When true, the personalization profile includes Adobe Commerce customer segments from the storefront `customerSegments(cartId)` GraphQL query (Adobe Commerce 2.4.7+). Requires a masked cart id in the session. Defaults to false; leave off on Magento Open Source, which lacks the query.' }),
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
