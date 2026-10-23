import * as z from 'zod';
import { BaseModelSchema } from './base.model.js';
import type { InferType } from '../../zod-utils.js';

export const IdentityProviderIdentifierSchema = z.looseObject({
    key: z.string(),
});

export const IdentityProviderSchema = BaseModelSchema.extend({
    identifier: IdentityProviderIdentifierSchema,
    displayName: z.string(),
    brand: z.string().optional().meta({ description: 'A neutral slug for the identity provider\'s brand, such as google, apple, amazon, facebook, microsoft or email, so a storefront can choose its own icon. Absent when the brand is not known.' }),
    flow: z.enum(['credentials', 'redirect']).meta({ description: 'credentials: the shopper types a username and password into the storefront. redirect: the shopper is sent to an external identity provider and returns with a code.' }),
});

export const ExternalLoginRedirectSchema = z.looseObject({
    location: z.url().meta({ description: 'Where to send the shopper to authenticate with the external identity provider.' }),
});

export const PASSWORD_IDENTITY_PROVIDER: InferType<typeof IdentityProviderSchema> = IdentityProviderSchema.parse({
    identifier: { key: 'password' },
    displayName: 'Email and password',
    brand: 'email',
    flow: 'credentials',
});

export type IdentityProviderIdentifier = InferType<typeof IdentityProviderIdentifierSchema>;
export type IdentityProvider = InferType<typeof IdentityProviderSchema>;
export type ExternalLoginRedirect = InferType<typeof ExternalLoginRedirectSchema>;
