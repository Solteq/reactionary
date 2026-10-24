import * as z from 'zod';
import { ExternalIdentityProviderSchema } from '@reactionary/oidc';
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
    externalIdentityProviders: z.array(ExternalIdentityProviderSchema).optional().meta({ description: 'OpenID Connect identity providers shoppers can sign in with. commercetools has no social login of its own: reactionary runs the OpenID Connect flow, then creates or finds the customer (externalId = <iss>|<sub>) with the admin client, and commercetools accepts the identity provider\'s access token on the /me endpoints through the project\'s externalOAuth introspection endpoint. The access token must be one that endpoint can verify (a JWT; for Auth0 set authorizationParams.audience). The admin API client needs manage_customers and manage_orders.' }),
    bopis: z.looseObject({
        shippingMethodKeys: z.array(z.string()).default(() => []).meta({ description: 'The keys of the commercetools shipping methods that represent in-store pickup (BOPIS). Shipping methods with these keys are tagged with fulfillmentType "pickup"; all others are tagged "delivery".' }),
    }).optional().meta({ description: 'Optional buy-online-pickup-in-store (BOPIS) configuration.' }),
});

export type CommercetoolsConfiguration = z.infer<typeof CommercetoolsConfigurationSchema>;
