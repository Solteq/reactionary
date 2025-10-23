import { z } from 'zod';

export const MedusaConfigurationSchema = z.looseObject({
    publishable_key: z.string(),
    apiUrl: z.string(),
    defaultRegion: z.string().default('FI'),
    allRegions: z.string().array().default([]),
});

export type MedusaConfiguration = z.infer<typeof MedusaConfigurationSchema>;
