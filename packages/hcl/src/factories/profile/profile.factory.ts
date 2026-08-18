import type {
  Address,
  AnyProfileSchema,
  Profile,
  ProfileFactory,
  ProfileSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type {
  HclPersonResponse,
  HclWcsPersonContact,
} from '../../schema/hcl.schema.js';

/** NickName reserved for the billing address in the WCS contact list. */
const BILLING_NICK_NAME = 'Billing';

export class HclProfileFactory<
  TProfileSchema extends AnyProfileSchema = typeof ProfileSchema,
> implements ProfileFactory<TProfileSchema>
{
  public readonly profileSchema: TProfileSchema;

  constructor(profileSchema: TProfileSchema) {
    this.profileSchema = profileSchema;
  }

  public parseProfile(
    context: RequestContext,
    data: HclPersonResponse,
  ): z.output<TProfileSchema> {
    const contacts = data.contact ?? [];

    const billingContact = contacts.find(
      (c) => c.nickName === BILLING_NICK_NAME,
    );
    const shippingContacts = contacts.filter(
      (c) => c.nickName !== BILLING_NICK_NAME,
    );

    // The contact marked primary='1' is the default shipping address;
    // fall back to the first non-billing contact when none is marked.
    const defaultShipping =
      shippingContacts.find((c) => c.primary === '1') ?? shippingContacts[0];
    const alternates = shippingContacts.filter((c) => c !== defaultShipping);

    const result = {
      identifier: { userId: data.userId },
      email: data.email1 ?? data.logonId ?? '',
      phone: data.phone1 ?? '',
      emailVerified: false,
      phoneVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      billingAddress: billingContact
        ? this.parseAddress(context, billingContact)
        : undefined,
      shippingAddress: defaultShipping
        ? this.parseAddress(context, defaultShipping)
        : undefined,
      alternateShippingAddresses: alternates.map((c) =>
        this.parseAddress(context, c),
      ),
    } satisfies Profile;

    return this.profileSchema.parse(result);
  }

  protected parseAddress(
    _context: RequestContext,
    contact: HclWcsPersonContact,
  ): Address {
    return {
      identifier: { nickName: contact.nickName },
      firstName: contact.firstName ?? '',
      lastName: contact.lastName ?? '',
      streetAddress: contact.addressLine?.[0] ?? contact.address1 ?? '',
      streetNumber: contact.addressLine?.[1] ?? '',
      city: contact.city ?? '',
      region: contact.stateOrProvinceName ?? '',
      postalCode: contact.zipCode ?? '',
      countryCode: contact.country ?? '',
    };
  }
}
