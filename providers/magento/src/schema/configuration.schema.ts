import { z } from 'zod';

export const MagentoConfigurationSchema = z.looseObject({
  adminApiKey: z.string().describe('The API key for Magento admin operations. Needed for the few tasks that require admin access.'),
  apiUrl: z.string().describe('The base URL for the Magento API.'),
  defaultCurrency: z.string().default(''),
  allCurrencies: z.string().array().default([]),
});

export type MagentoConfiguration = z.infer<typeof MagentoConfigurationSchema>;
