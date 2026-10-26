import { describe, expect, it } from 'vitest';
import { externalLoginResult, profileFromOidcClaims } from '../utils/oidc-claims.js';

describe('profileFromOidcClaims', () => {
  it('reads the first address of an Azure B2C emails array when there is no email claim', () => {
    expect(profileFromOidcClaims({ emails: ['ada@example.com', 'other@example.com'] }).email).toBe('ada@example.com');
    expect(profileFromOidcClaims({ email: 'ada@example.com', emails: ['other@example.com'] }).email).toBe('ada@example.com');
    expect(profileFromOidcClaims({ emails: [] }).email).toBeUndefined();
  });

  it('reads email, names and phone', () => {
    expect(
      profileFromOidcClaims({
        email: 'ada@example.com',
        email_verified: true,
        given_name: 'Ada',
        family_name: 'Lovelace',
        phone_number: ' +4512345678 ',
        phone_number_verified: false,
      }),
    ).toEqual({
      email: 'ada@example.com',
      emailVerified: true,
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+4512345678',
      phoneVerified: false,
    });
  });

  it('splits name when given_name and family_name are missing', () => {
    expect(profileFromOidcClaims({ name: 'Ada King Lovelace' })).toEqual({ firstName: 'Ada', lastName: 'King Lovelace' });
    expect(profileFromOidcClaims({ name: 'Cher' })).toEqual({ firstName: 'Cher' });
  });

  it('does not invent values', () => {
    expect(profileFromOidcClaims({})).toEqual({});
    expect(profileFromOidcClaims({ email: 42, given_name: '  ', phone_number: null })).toEqual({});
  });

  it('turns a complete address into a billing address', () => {
    const result = profileFromOidcClaims({
      given_name: 'Ada',
      family_name: 'Lovelace',
      address: { street_address: 'Main Street 1', locality: 'Copenhagen', region: 'Hovedstaden', postal_code: '1000', country: 'dk' },
    });
    expect(result.billingAddress).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      streetAddress: 'Main Street 1',
      city: 'Copenhagen',
      region: 'Hovedstaden',
      postalCode: '1000',
      countryCode: 'DK',
    });
  });

  it.each([
    ['no street', { locality: 'Copenhagen', postal_code: '1000', country: 'DK' }],
    ['no city', { street_address: 'Main Street 1', postal_code: '1000', country: 'DK' }],
    ['no postal code', { street_address: 'Main Street 1', locality: 'Copenhagen', country: 'DK' }],
    ['a country name instead of an ISO code', { street_address: 'Main Street 1', locality: 'Copenhagen', postal_code: '1000', country: 'Denmark' }],
  ])('drops an address with %s', (_title, address) => {
    expect(profileFromOidcClaims({ address }).billingAddress).toBeUndefined();
  });
});

describe('externalLoginResult', () => {
  const claims = { email: 'ada@example.com', given_name: 'Ada', phone_number: '+4512345678' };

  it('carries the profile data of a new customer', () => {
    expect(externalLoginResult(claims, true)).toEqual({
      isNewCustomer: true,
      profile: { email: 'ada@example.com', firstName: 'Ada', phone: '+4512345678' },
    });
  });

  it('carries nothing for a returning customer', () => {
    expect(externalLoginResult(claims, false)).toEqual({ isNewCustomer: false, profile: {} });
  });
});
