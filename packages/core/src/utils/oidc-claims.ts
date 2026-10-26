import * as z from 'zod';
import type { ExternalLoginResult } from '../schemas/models/identity.model.js';
import { AddressSchema, type Address } from '../schemas/models/profile.model.js';
import type { InferType } from '../zod-utils.js';

/** What a storefront can put on a profile, from the standard claims of an OpenID Connect identity. */
export const ProfileFromOidcClaimsSchema = z.looseObject({
  email: z.string().optional(),
  emailVerified: z.boolean().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  phoneVerified: z.boolean().optional(),
  billingAddress: AddressSchema.optional().meta({ description: 'Only when the address claim is complete: street, city, postal code and a two letter country.' }),
});

export type ProfileFromOidcClaims = InferType<typeof ProfileFromOidcClaimsSchema>;

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Reads the OpenID Connect standard claims (OpenID Connect Core section 5.1) the way every backend should:
 * names fall back to splitting `name`, and the address becomes a billing address only if it is complete enough to ship to.
 * Nothing is invented, so a backend that needs a value (Magento wants both names) applies its own default.
 */
export function profileFromOidcClaims(claims: Record<string, unknown>): ProfileFromOidcClaims {
  let firstName = text(claims['given_name']);
  let lastName = text(claims['family_name']);
  if (!firstName && !lastName) {
    const [first, ...rest] = (text(claims['name']) ?? '').split(/\s+/).filter(Boolean);
    firstName = first;
    lastName = rest.join(' ') || undefined;
  }

  // Azure B2C can deliver the address as an `emails` array instead of `email`.
  const emails = claims['emails'];
  const email = text(claims['email']) ?? (Array.isArray(emails) ? text(emails[0]) : undefined);
  const phone = text(claims['phone_number']);

  const rawAddress = claims['address'];
  const address = rawAddress && typeof rawAddress === 'object' ? (rawAddress as Record<string, unknown>) : {};
  const country = text(address['country'])?.toUpperCase();
  const street = text(address['street_address']);
  const city = text(address['locality']);
  const postalCode = text(address['postal_code']);
  let billingAddress: Address | undefined;
  if (street && city && postalCode && country && /^[A-Z]{2}$/.test(country)) {
    const parsed = AddressSchema.safeParse({
      identifier: { nickName: 'billing' },
      firstName: firstName ?? '',
      lastName: lastName ?? '',
      streetAddress: street,
      streetNumber: '',
      city,
      region: text(address['region']) ?? '',
      postalCode,
      countryCode: country,
    });
    billingAddress = parsed.success ? parsed.data : undefined;
  }

  return {
    ...(email ? { email } : {}),
    ...(typeof claims['email_verified'] === 'boolean' ? { emailVerified: claims['email_verified'] } : {}),
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(phone ? { phone } : {}),
    ...(typeof claims['phone_number_verified'] === 'boolean' ? { phoneVerified: claims['phone_number_verified'] } : {}),
    ...(billingAddress ? { billingAddress } : {}),
  };
}

/**
 * What a backend reports about an external login, for the storefront to put on the profile (see applyExternalLoginProfile).
 * A returning customer carries no profile data: nothing the identity provider says may overwrite what the shop knows.
 */
export function externalLoginResult(claims: Record<string, unknown>, isNewCustomer: boolean): ExternalLoginResult {
  if (!isNewCustomer) {
    return { isNewCustomer, profile: {} };
  }
  const { email, firstName, lastName, phone, billingAddress } = profileFromOidcClaims(claims);
  return {
    isNewCustomer,
    profile: {
      ...(email ? { email } : {}),
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(phone ? { phone } : {}),
      ...(billingAddress ? { billingAddress } : {}),
    },
  };
}
