import * as z from 'zod';

export const MedusaConfigurationSchema = z.looseObject({
    publishable_key: z.string().meta({ description: 'The publishable API key for the Medusa store. Used for all storefront operations.' }),
    adminApiKey: z.string().meta({ description: 'The API key for Medusa admin operations. Needed for the few tasks that require admin access.' }),
    apiUrl: z.string().meta({ description: 'The base URL for the Medusa API.' }),
    defaultCurrency: z.string().default(''),
    allCurrencies: z.array(z.string()),
});

export type MedusaConfiguration = z.infer<typeof MedusaConfigurationSchema>;
