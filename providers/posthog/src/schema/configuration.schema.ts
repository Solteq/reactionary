import * as z from 'zod';

export const PosthogConfigurationSchema = z.looseObject({
    apiKey: z.string(),
    host: z.string(),
});

export type PosthogConfiguration = z.infer<typeof PosthogConfigurationSchema>;