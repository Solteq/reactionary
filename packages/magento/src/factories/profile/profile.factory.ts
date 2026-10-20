import type {
  Address,
  AnyProfileSchema,
  Profile,
  ProfileFactory,
  ProfileSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import {
  type MagentoAddressPayload,
  MagentoCustomerPayloadSchema,
} from '../../schema/customer.types.js';
import { toIsoTimestamp } from '../../utils/magento-review.js';

export type { MagentoAddress, MagentoCustomer } from '../../schema/customer.types.js';

export interface MagentoProfileFactoryOptions {
  /**
   * The customer-address custom attribute that holds the address nickname.
   * Magento has no native address label, so by default the nickname is kept
   * in the address `company` field.
   */
  addressNicknameAttribute?: string;
}

/**
 * Reads an address nickname from the configured custom attribute, falling
 * back to `company` (Magento has no native address label).
 */
export function readMagentoAddressNickname(
  address: {
    company?: string;
    custom_attributes?: ReadonlyArray<{ attribute_code: string; value: unknown }>;
  },
  addressNicknameAttribute?: string,
): string {
  if (addressNicknameAttribute) {
    const value = address.custom_attributes?.find(
      (a) => a.attribute_code === addressNicknameAttribute,
    )?.value;
    return typeof value === 'string' ? value : '';
  }
  return address.company ?? '';
}

export class MagentoProfileFactory<
  TProfileSchema extends AnyProfileSchema = typeof ProfileSchema,
> implements ProfileFactory<TProfileSchema>
{
  public readonly profileSchema: TProfileSchema;
  protected readonly options: MagentoProfileFactoryOptions;

  constructor(
    profileSchema: TProfileSchema,
    options: MagentoProfileFactoryOptions = {},
  ) {
    this.profileSchema = profileSchema;
    this.options = options;
  }

  public parseProfile(
    context: RequestContext,
    data: unknown,
  ): z.output<TProfileSchema> {
    const customer = MagentoCustomerPayloadSchema.parse(data);

    const addresses = customer.addresses ?? [];
    const billingId = customer.default_billing;
    const shippingId = customer.default_shipping;

    let billingAddress: Address | undefined;
    let shippingAddress: Address | undefined;
    let billingTelephone: string | undefined;
    let shippingTelephone: string | undefined;
    const alternateShippingAddresses: Address[] = [];

    for (const address of addresses) {
      const parsed = this.parseAddress(context, address);
      const id = address.id !== undefined ? String(address.id) : undefined;
      const isBilling = id !== undefined && id === billingId;
      const isShipping = id !== undefined && id === shippingId;

      // An address can be the default for both billing and shipping.
      if (isBilling) {
        billingAddress = parsed;
        billingTelephone = address.telephone;
      }
      if (isShipping) {
        shippingAddress = parsed;
        shippingTelephone = address.telephone;
      }
      if (!isBilling && !isShipping) {
        alternateShippingAddresses.push(parsed);
      }
    }

    // Magento has no customer-level phone: its native phone field is the
    // address `telephone`, so the default billing (then shipping) one is used.
    const phone = billingTelephone || shippingTelephone || '';

    // Magento only sets `confirmation` while the e-mail awaits confirmation.
    const emailVerified = !customer.confirmation;

    // Timestamps are passed through as Magento reports them; none is invented.
    const createdAt = customer.created_at
      ? toIsoTimestamp(customer.created_at)
      : '';
    const updatedAt = customer.updated_at
      ? toIsoTimestamp(customer.updated_at)
      : createdAt;

    const result = {
      identifier: {
        userId: String(customer.id),
      },
      email: customer.email,
      firstName: customer.firstname,
      lastName: customer.lastname,
      emailVerified,
      phone,
      phoneVerified: false,
      billingAddress,
      shippingAddress,
      alternateShippingAddresses,
      createdAt,
      updatedAt,
    } satisfies Profile;

    return this.profileSchema.parse(result);
  }

  protected parseAddress(
    _context: RequestContext,
    address: MagentoAddressPayload,
  ): Address {
    const street = address.street ?? [];
    return {
      identifier: {
        nickName: readMagentoAddressNickname(
          address,
          this.options.addressNicknameAttribute,
        ),
      },
      firstName: address.firstname || '',
      lastName: address.lastname || '',
      streetAddress: street[0] || '',
      streetNumber: street[1] || '',
      city: address.city || '',
      region: address.region?.region || address.region?.region_code || '',
      postalCode: address.postcode || '',
      countryCode: address.country_id || '',
    };
  }
}
