import { z } from 'zod';

export const AlgoliaConfigurationSchema = z.interface({
    appId: z.string(),
    apiKey: z.string(),
    indexName: z.string()
});

export type AlgoliaConfiguration = z.infer<typeof AlgoliaConfigurationSchema>;