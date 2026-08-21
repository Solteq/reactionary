import * as z from 'zod';

export const MagentoConfigurationSchema = z.looseObject({
  adminApiKey: z.string().meta({ description: 'The API key for Magento admin operations. Needed for the few tasks that require admin access.' }),
  baseUrl: z.string().meta({ description: 'The base URL for the Magento installation.' }),
  mediaUrl: z.string().optional().meta({ description: 'The base URL for media files. If not provided, it will be derived from the baseUrl.' }),
  mediaSource: z.enum(['EXTERNAL', 'DEFAULT']).default('DEFAULT').meta({ description: 'Where product imagery is taken from. DEFAULT uses the Magento media gallery. EXTERNAL uses the `original_dam_reference` attribute, which holds the PIM-sorted list of DAM image URLs.' }),
  defaultCurrency: z.string().default(''),
  rootCategoryId: z.string().default('2').meta({ description: 'The ID of the root category in Magento. Typically "2" for the default Magento setup.' }),
  allCurrencies: z.array(z.string()),
  storeCode: z.string().default(''),
  authStoreCode: z.string().default('default').meta({ description: 'The store/website scope used for customer authentication and account operations (token, customers/me). Customers typically live on the default website, which may differ from the catalog storeCode.' }),
});

export type MagentoConfiguration = z.infer<typeof MagentoConfigurationSchema>;
