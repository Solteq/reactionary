import * as z from 'zod';
import { PaymentMethodSchema } from '@reactionary/core';

export const CommercetoolsConfigurationSchema = z.looseObject({
    projectKey: z.string(),
    authUrl: z.string(),
    apiUrl: z.string(),
    clientId: z.string(),
    clientSecret: z.string(),
    scopes: z.array(z.string()).default(() => []),
    adminClientId: z.string().optional(),
    adminClientSecret: z.string().optional(),
    paymentMethods: PaymentMethodSchema.array().optional().default(() => []),
    facetFieldsForSearch: z.array(z.string()).default(() => []),
    listPriceChannelKey: z.string().optional(),
    customerPriceChannelKey: z.string().optional(),
    bopis: z.looseObject({
        shippingMethodKeys: z.array(z.string()).default(() => []).meta({ description: 'The keys of the commercetools shipping methods that represent in-store pickup (BOPIS). Shipping methods with these keys are tagged with fulfillmentType "pickup"; all others are tagged "delivery".' }),
    }).optional().meta({ description: 'Optional buy-online-pickup-in-store (BOPIS) configuration.' }),
});

export type CommercetoolsConfiguration = z.infer<typeof CommercetoolsConfigurationSchema>;
