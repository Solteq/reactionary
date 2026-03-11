import type { StoreCustomer, StoreCustomerAddress } from '@medusajs/types';
import type {
  Address,
  AnyProfileSchema,
  Profile,
  ProfileFactory,
  ProfileSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class MedusaProfileFactory<
  TProfileSchema extends AnyProfileSchema = typeof ProfileSchema,
> implements ProfileFactory<TProfileSchema>
{
  public readonly profileSchema: TProfileSchema;

  constructor(profileSchema: TProfileSchema) {
    this.profileSchema = profileSchema;
  }

  public parseProfile(
    context: RequestContext,
    data: StoreCustomer,
  ): z.output<TProfileSchema> {
    const email = data.email;
    const emailVerified = data.metadata?.['email_verified'] === 'true';

    const phone = data.phone || '';
    const phoneVerified = data.metadata?.['phone_verified'] === 'true';

    const addresses = data.addresses || [];
    let billingAddress: Address | undefined = undefined;
    let shippingAddress: Address | undefined = undefined;

    const existingBillingAddress = data.addresses.find(
      (addr) => addr.is_default_billing,
    );
    if (existingBillingAddress) {
      billingAddress = this.parseAddress(context, existingBillingAddress);
    }

    const existingShippingAddress = data.addresses.find(
      (addr) => addr.is_default_shipping,
    );
    if (existingShippingAddress) {
      shippingAddress = this.parseAddress(context, existingShippingAddress);
    }

    const alternateShippingAddresses: Address[] = [];

    alternateShippingAddresses.push(
      ...addresses
        .filter((x) => !(x.is_default_billing || x.is_default_shipping))
        .map((addr) => this.parseAddress(context, addr)),
    );

    const result = {
      identifier: {
        userId: data.id,
      },
      email,
      emailVerified,
      phone,
      phoneVerified,
      billingAddress: billingAddress,
      shippingAddress: shippingAddress,
      alternateShippingAddresses: alternateShippingAddresses,
      createdAt: new Date(data.created_at || '').toISOString(),
      updatedAt: new Date(data.updated_at || '').toISOString(),
    } satisfies Profile;

    return this.profileSchema.parse(result);
  }

  protected parseAddress(
    context: RequestContext,
    address: StoreCustomerAddress,
  ): Address {
    return {
      identifier: {
        nickName: address.address_name || '',
      },
      firstName: address.first_name || '',
      lastName: address.last_name || '',
      streetAddress: address.address_1 || '',
      streetNumber: address.address_2 || '',
      city: address.city || '',
      region: address.province || '',
      postalCode: address.postal_code || '',
      countryCode: address.country_code || '',
    };
  }
}
