import { z } from 'zod';

export const MedusaConfigurationSchema = z.looseObject({
    publishable_key: z.string().describe('The publishable API key for the Medusa store. Used for all storefront operations.'),
    adminApiKey: z.string().describe('The API key for Medusa admin operations. Needed for the few tasks that require admin access.'),
    apiUrl: z.string().describe('The base URL for the Medusa API.'),
    defaultRegion: z.string().default('FI'),
    allRegions: z.string().array().default([]),
});

export type MedusaConfiguration = z.infer<typeof MedusaConfigurationSchema>;
