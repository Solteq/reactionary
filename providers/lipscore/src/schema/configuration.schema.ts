import * as z from 'zod';

export const LipscoreConfigurationSchema = z.looseObject({
  apiKey: z.string().meta({ description: 'Lipscore API key' }),
  apiSecretKey: z.string().meta({ description: 'Lipscore API Secret Key' }),
  apiUrl: z.string().default('https://api.lipscore.com/v1').meta({ description: 'Lipscore API base URL' }),
});

export type LipscoreConfiguration = z.infer<typeof LipscoreConfigurationSchema>;
