import * as z from 'zod';

export const AlgoliaConfigurationSchema = z.looseObject({
  appId: z.string(),
  apiKey: z.string(),
  indexName: z.string(),
});

export type AlgoliaConfiguration = z.infer<typeof AlgoliaConfigurationSchema>;
