import * as z from 'zod';

export const UnomiConfigurationSchema = z.looseObject({
  apiUrl: z.string().url(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  profilePath: z.string().default('/cxs/profiles'),
  scope: z.string().default('default'),
});

export type UnomiConfiguration = z.infer<typeof UnomiConfigurationSchema>;
