import * as z from 'zod';
import { ExternalIdentityProviderSchema } from '@reactionary/oidc';
import { PaymentMethodSchema, ProductAssetTypeSchema } from '@reactionary/core';

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
    productAssets: z.looseObject({
        tagTypeMap: z.record(z.string(), ProductAssetTypeSchema).optional().meta({ description: 'Maps commercetools asset tags to product asset types, in addition to the defaults (the asset type names themselves, e.g. the tag "manual" is a manual). An asset without a mapped tag is type "other".' }),
        languageTagPrefix: z.string().default('lang:').meta({ description: 'Prefix of the asset tag that carries the language of the asset content, e.g. "lang:en".' }),
    }).optional().meta({ description: 'Optional product asset (manuals, certificates, videos, 3D models) configuration.' }),
    bopis: z.looseObject({
        shippingMethodKeys: z.array(z.string()).default(() => []).meta({ description: 'The keys of the commercetools shipping methods that represent in-store pickup (BOPIS). Shipping methods with these keys are tagged with fulfillmentType "pickup"; all others are tagged "delivery".' }),
    }).optional().meta({ description: 'Optional buy-online-pickup-in-store (BOPIS) configuration.' }),
});

export type CommercetoolsConfiguration = z.infer<typeof CommercetoolsConfigurationSchema>;
