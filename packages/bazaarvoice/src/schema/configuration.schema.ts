import * as z from 'zod';

export const BazaarvoiceConfigurationSchema = z.looseObject({
  passKey: z.string().meta({ description: 'Bazaarvoice API passkey.' }),
  apiUrl: z.string().default('https://api.bazaarvoice.com').meta({
    description:
      'Base API URL. Use https://stg.api.bazaarvoice.com for staging.',
  }),
  apiVersion: z
    .string()
    .default('5.4')
    .meta({ description: 'Conversations API version.' }),
});

export type BazaarvoiceConfiguration = z.infer<
  typeof BazaarvoiceConfigurationSchema
>;
