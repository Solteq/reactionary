import type {
  Address,
  AnyProfileSchema,
  Profile,
  ProfileFactory,
  ProfileSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export interface MagentoAddress {
  id?: number;
  customer_id?: number;
  company?: string;
  firstname?: string;
  lastname?: string;
  street?: string[];
  city?: string;
  region?: { region_code?: string; region?: string; region_id?: number };
  region_id?: number;
  postcode?: string;
  country_id?: string;
  telephone?: string;
  default_billing?: boolean;
  default_shipping?: boolean;
}

export interface MagentoCustomer {
  id: number;
  email: string;
  firstname?: string;
  lastname?: string;
  created_at?: string;
  updated_at?: string;
  default_billing?: string;
  default_shipping?: string;
  addresses?: MagentoAddress[];
  custom_attributes?: { attribute_code: string; value: string }[];
}

export class MagentoProfileFactory<
  TProfileSchema extends AnyProfileSchema = typeof ProfileSchema,
> implements ProfileFactory<TProfileSchema>
{
  public readonly profileSchema: TProfileSchema;

  constructor(profileSchema: TProfileSchema) {
    this.profileSchema = profileSchema;
  }

  public parseProfile(
    context: RequestContext,
    data: unknown,
  ): z.output<TProfileSchema> {
    const customer = data as MagentoCustomer;

    const phone =
      customer.custom_attributes?.find((a) => a.attribute_code === 'phone')
        ?.value ?? '';

    const addresses = customer.addresses ?? [];

    const billingId = customer.default_billing;
    const shippingId = customer.default_shipping;

    let billingAddress: Address | undefined;
    let shippingAddress: Address | undefined;
    const alternateShippingAddresses: Address[] = [];

    for (const address of addresses) {
      const parsed = this.parseAddress(context, address);
      const id = address.id !== undefined ? String(address.id) : undefined;

      if (id && billingId && id === billingId) {
        billingAddress = parsed;
      } else if (id && shippingId && id === shippingId) {
        shippingAddress = parsed;
      } else {
        alternateShippingAddresses.push(parsed);
      }
    }

    const result = {
      identifier: {
        userId: String(customer.id),
      },
      email: customer.email,
      emailVerified: true,
      phone,
      phoneVerified: false,
      billingAddress,
      shippingAddress,
      alternateShippingAddresses,
      createdAt: new Date(customer.created_at || Date.now()).toISOString(),
      updatedAt: new Date(customer.updated_at || Date.now()).toISOString(),
    } satisfies Profile;

    return this.profileSchema.parse(result);
  }

  protected parseAddress(
    _context: RequestContext,
    address: MagentoAddress,
  ): Address {
    const street = address.street ?? [];
    return {
      identifier: {
        nickName: address.company || '',
      },
      firstName: address.firstname || '',
      lastName: address.lastname || '',
      streetAddress: street[0] || '',
      streetNumber: street[1] || '',
      city: address.city || '',
      region: address.region?.region || '',
      postalCode: address.postcode || '',
      countryCode: address.country_id || '',
    };
  }
}
