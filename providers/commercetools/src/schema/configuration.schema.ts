import { z } from 'zod';

export const CommercetoolsConfigurationSchema = z.looseInterface({
    projectKey: z.string(),
    authUrl: z.string(),
    apiUrl: z.string(),
    clientId: z.string(),
    clientSecret: z.string()
});

export type CommercetoolsConfiguration = z.infer<typeof CommercetoolsConfigurationSchema>;