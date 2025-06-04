import { z } from 'zod';

export const PosthogConfigurationSchema = z.looseInterface({
    apiKey: z.string(),
    host: z.string(),
});

export type PosthogConfiguration = z.infer<typeof PosthogConfigurationSchema>;