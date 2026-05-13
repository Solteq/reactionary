import * as z from 'zod';

export const HclConfigurationSchema = z.looseObject({
  apiUrl: z
    .string()
    .meta({ description: 'The base URL for the HCL Commerce REST API.' }),
  storeId: z
    .string()
    .meta({ description: 'The HCL Commerce store identifier.' }),
  catalogId: z
    .string()
    .meta({ description: 'The HCL Commerce catalog identifier.' }),
  langId: z
    .string()
    .default('-1')
    .meta({
      description:
        'The HCL Commerce language identifier. Defaults to -1 (English).',
    }),
  currency: z
    .string()
    .default('USD')
    .meta({ description: 'The currency to use for pricing.' }),
});

export type HclConfiguration = z.infer<typeof HclConfigurationSchema>;
