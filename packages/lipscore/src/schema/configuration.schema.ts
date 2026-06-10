import * as z from 'zod';

export const LipscoreConfigurationSchema = z.looseObject({
  apiKey: z.string().meta({ description: 'Lipscore public API key.' }),
  apiSecret: z
    .string()
    .optional()
    .meta({
      description:
        'Lipscore server-side API secret. When set it is sent as the X-Authorization header.',
    }),
  apiUrl: z
    .string()
    .default('https://api.lipscore.com')
    .meta({ description: 'Base Lipscore API URL.' }),
});

export type LipscoreConfiguration = z.infer<typeof LipscoreConfigurationSchema>;
