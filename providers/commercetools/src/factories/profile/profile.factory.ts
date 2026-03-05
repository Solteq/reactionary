import type { Address as CTAddress, Customer } from '@commercetools/platform-sdk';
import type {
  ProfileSchema} from '@reactionary/core';
import {
  type Address,
  type AnyProfileSchema,
  type Profile,
  type ProfileFactory,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class CommercetoolsProfileFactory<
  TProfileSchema extends AnyProfileSchema = typeof ProfileSchema,
> implements ProfileFactory<TProfileSchema>
{
  public readonly profileSchema: TProfileSchema;

  constructor(profileSchema: TProfileSchema) {
    this.profileSchema = profileSchema;
  }

  public parseProfile(
    _context: RequestContext,
    data: Customer,
  ): z.output<TProfileSchema> {
    const email = data.email;
    const emailVerified = data.isEmailVerified;
    let defaultBilling = data.addresses.find((address) => address.id === data.defaultBillingAddressId);
    const phone = defaultBilling?.phone ?? '';

    if (this.isIncompleteAddress(defaultBilling)) {
      defaultBilling = undefined;
    }

    const defaultShipping = data.addresses.find(
      (address) => address.id === data.defaultShippingAddressId,
    );

    const alternateShippingAddresses = data.addresses
      .filter((address) => address.id !== data.defaultBillingAddressId)
      .filter((address) => address.id !== data.defaultShippingAddressId)
      .map((address) => this.parseAddress(address));

    const billingAddress = defaultBilling ? this.parseAddress(defaultBilling) : undefined;
    const shippingAddress = defaultShipping ? this.parseAddress(defaultShipping) : undefined;

    const result = {
      identifier: {
        userId: data.id,
      },
      email,
      emailVerified,
      alternateShippingAddresses,
      billingAddress,
      shippingAddress,
      createdAt: data.createdAt,
      phone,
      phoneVerified: false,
      updatedAt: data.lastModifiedAt,
    } satisfies Profile;

    return this.profileSchema.parse(result);
  }

  protected parseAddress(address: CTAddress): Address {
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

  protected isIncompleteAddress(address: CTAddress | undefined): boolean {
    if (!address) {
      return false;
    }
    return (
      !address.firstName &&
      !address.lastName &&
      !address.streetName &&
      !address.streetNumber &&
      !address.city
    );
  }
}
