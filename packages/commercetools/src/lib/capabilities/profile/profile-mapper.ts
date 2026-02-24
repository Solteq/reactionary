import type { Address, Profile } from '@reactionary/core';
import type { Address as CTAddress, Customer } from '@commercetools/platform-sdk';

export function parseCommercetoolsProfileAddress(address: CTAddress): Address {
  return {
    identifier: {
      nickName: address.key || '',
    },
    firstName: address.firstName || '',
    lastName: address.lastName || '',
    streetAddress: address.streetName || '',
    streetNumber: address.streetNumber || '',
    city: address.city || '',
    region: address.region || '',
    postalCode: address.postalCode || '',
    countryCode: address.country,
  } satisfies Address;
}

export function isCommercetoolsIncompleteAddress(address: CTAddress | undefined): boolean {
  if (!address) {
    return false;
  }

  return !address.firstName && !address.lastName && !address.streetName && !address.streetNumber && !address.city;
}

export function createCommercetoolsAddressDraft(
  address: Address,
  defaultCountryCode: string,
): CTAddress {
  return {
    key: address.identifier.nickName,
    firstName: address.firstName,
    lastName: address.lastName,
    streetName: address.streetAddress,
    streetNumber: address.streetNumber,
    postalCode: address.postalCode,
    city: address.city,
    region: address.region,
    country: address.countryCode || defaultCountryCode,
  };
}

export function parseCommercetoolsProfile(customer: Customer): Profile {
  let defaultCTBillingAddress = customer.addresses.find((address) => address.id === customer.defaultBillingAddressId);
  const phone = defaultCTBillingAddress?.phone ?? '';

  if (isCommercetoolsIncompleteAddress(defaultCTBillingAddress)) {
    defaultCTBillingAddress = undefined;
  }

  const defaultCTShippingAddress = customer.addresses.find((address) => address.id === customer.defaultShippingAddressId);

  const alternateShippingAddresses = customer.addresses
    .filter((address) => address.id !== customer.defaultBillingAddressId && address.id !== customer.defaultShippingAddressId)
    .map(parseCommercetoolsProfileAddress);
  const billingAddress = defaultCTBillingAddress ? parseCommercetoolsProfileAddress(defaultCTBillingAddress) : undefined;
  const shippingAddress = defaultCTShippingAddress ? parseCommercetoolsProfileAddress(defaultCTShippingAddress) : undefined;

  return {
    identifier: {
      userId: customer.id,
    },
    email: customer.email,
    emailVerified: customer.isEmailVerified,
    alternateShippingAddresses,
    billingAddress,
    shippingAddress,
    createdAt: customer.createdAt,
    phone,
    phoneVerified: false,
    updatedAt: customer.lastModifiedAt,
  } satisfies Profile;
}
