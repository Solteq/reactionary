import * as z from 'zod';

export const MagentoConfigurationSchema = z.looseObject({
  adminApiKey: z.string().meta({ description: 'The API key for Magento admin operations. Needed for the few tasks that require admin access.' }),
  baseUrl: z.string().meta({ description: 'The base URL for the Magento installation.' }),
  mediaUrl: z.string().optional().meta({ description: 'The base URL for media files. If not provided, it will be derived from the baseUrl.' }),
  defaultCurrency: z.string().default(''),
  rootCategoryId: z.string().default('2').meta({ description: 'The ID of the root category in Magento. Typically "2" for the default Magento setup.' }),
  allCurrencies: z.array(z.string()),
  storeCode: z.string().default(''),
});

export type MagentoConfiguration = z.infer<typeof MagentoConfigurationSchema>;
