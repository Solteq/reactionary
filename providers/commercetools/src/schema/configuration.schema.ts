import * as z from 'zod';
import { PaymentMethodSchema } from '@reactionary/core';

export const CommercetoolsConfigurationSchema = z.looseObject({
    projectKey: z.string(),
    authUrl: z.string(),
    apiUrl: z.string(),
    clientId: z.string(),
    clientSecret: z.string(),
    scopes: z.array(z.string()).default(() => []),
    paymentMethods: PaymentMethodSchema.array().optional().default(() => []),
    facetFieldsForSearch: z.array(z.string()).default(() => []),
});

export type CommercetoolsConfiguration = z.infer<typeof CommercetoolsConfigurationSchema>;
