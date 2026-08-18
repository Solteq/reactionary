import {
  type Address,
  type Cache,
  type InvalidInputError,
  type NotFoundError,
  ProfileCapability,
  type ProfileFactory,
  type ProfileFactoryOutput,
  type ProfileFactoryWithOutput,
  type ProfileMutationAddShippingAddress,
  ProfileMutationAddShippingAddressSchema,
  type ProfileMutationMakeShippingAddressDefault,
  ProfileMutationMakeShippingAddressDefaultSchema,
  type ProfileMutationRemoveShippingAddress,
  ProfileMutationRemoveShippingAddressSchema,
  type ProfileMutationSetBillingAddress,
  ProfileMutationSetBillingAddressSchema,
  type ProfileMutationUpdate,
  ProfileMutationUpdateSchema,
  type ProfileMutationUpdateShippingAddress,
  ProfileMutationUpdateShippingAddressSchema,
  type ProfileQuerySelf as ProfileQueryById,
  ProfileQueryByIdSchema,
  ProfileSchema,
  Reactionary,
  type RequestContext,
  type Result,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoClient } from '../core/client.js';
import type {
  MagentoAddress,
  MagentoCustomer,
  MagentoProfileFactory,
} from '../factories/profile/profile.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const debug = createDebug('reactionary:magento:profile');

export class MagentoProfileCapability<
  TFactory extends ProfileFactory = MagentoProfileFactory,
> extends ProfileCapability<ProfileFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: ProfileFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: ProfileFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  protected async fetchCustomer(): Promise<MagentoCustomer | null> {
    try {
      return (await this.magentoApi.getMe()) as MagentoCustomer;
    } catch (err) {
      debug('fetchCustomer failed: %O', err);
      return null;
    }
  }

  protected buildMagentoAddress(
    address: Address,
    flags: { default_billing?: boolean; default_shipping?: boolean } = {},
    existing?: MagentoAddress,
  ): MagentoAddress {
    return {
      ...(existing?.id !== undefined ? { id: existing.id } : {}),
      company: address.identifier.nickName,
      firstname: address.firstName,
      lastname: address.lastName,
      street: [address.streetAddress, address.streetNumber],
      city: address.city,
      region: { region: address.region },
      postcode: address.postalCode,
      country_id: address.countryCode,
      telephone: existing?.telephone || '000',
      default_billing: flags.default_billing ?? false,
      default_shipping: flags.default_shipping ?? false,
    };
  }

  protected findByNickName(
    customer: MagentoCustomer,
    nickName: string,
  ): MagentoAddress | undefined {
    return (customer.addresses ?? []).find((a) => a.company === nickName);
  }

  @Reactionary({
    inputSchema: ProfileQueryByIdSchema,
    outputSchema: ProfileSchema,
  })
  public async getById(
    payload: ProfileQueryById,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    const customer = await this.fetchCustomer();
    if (!customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }
    return success(this.factory.parseProfile(this.context, customer));
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateSchema,
    outputSchema: ProfileSchema,
  })
  public async update(
    payload: ProfileMutationUpdate,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    const customer = await this.fetchCustomer();
    if (!customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const customAttributes = (customer.custom_attributes ?? []).filter(
      (a) => a.attribute_code !== 'phone',
    );
    if (payload.phone !== undefined) {
      customAttributes.push({ attribute_code: 'phone', value: payload.phone });
    }

    const updated = await this.magentoApi.updateMe({
      ...customer,
      email: payload.email ?? customer.email,
      custom_attributes: customAttributes,
    });

    return success(this.factory.parseProfile(this.context, updated));
  }

  @Reactionary({
    inputSchema: ProfileMutationAddShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async addShippingAddress(
    payload: ProfileMutationAddShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    const customer = await this.fetchCustomer();
    if (!customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    if (this.findByNickName(customer, payload.address.identifier.nickName)) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'Address with the same nickname already exists',
      });
    }

    const addresses = this.preserveAddresses(customer);
    addresses.push(this.buildMagentoAddress(payload.address));

    const updated = await this.magentoApi.updateMe({ ...customer, addresses });
    return success(this.factory.parseProfile(this.context, updated));
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async updateShippingAddress(
    payload: ProfileMutationUpdateShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    const customer = await this.fetchCustomer();
    if (!customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const existing = this.findByNickName(
      customer,
      payload.address.identifier.nickName,
    );
    if (!existing) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.address.identifier,
      });
    }

    const isBilling = String(existing.id) === customer.default_billing;
    const isShipping = String(existing.id) === customer.default_shipping;

    const addresses = this.preserveAddresses(customer).map((a) =>
      a.id === existing.id
        ? this.buildMagentoAddress(
            payload.address,
            { default_billing: isBilling, default_shipping: isShipping },
            existing,
          )
        : a,
    );

    const updated = await this.magentoApi.updateMe({ ...customer, addresses });
    return success(this.factory.parseProfile(this.context, updated));
  }

  @Reactionary({
    inputSchema: ProfileMutationRemoveShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async removeShippingAddress(
    payload: ProfileMutationRemoveShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    const customer = await this.fetchCustomer();
    if (!customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const existing = this.findByNickName(
      customer,
      payload.addressIdentifier.nickName,
    );
    if (!existing) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.addressIdentifier,
      });
    }

    const addresses = this.preserveAddresses(customer).filter(
      (a) => a.id !== existing.id,
    );

    const updated = await this.magentoApi.updateMe({ ...customer, addresses });
    return success(this.factory.parseProfile(this.context, updated));
  }

  @Reactionary({
    inputSchema: ProfileMutationMakeShippingAddressDefaultSchema,
    outputSchema: ProfileSchema,
  })
  public async makeShippingAddressDefault(
    payload: ProfileMutationMakeShippingAddressDefault,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    const customer = await this.fetchCustomer();
    if (!customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const existing = this.findByNickName(
      customer,
      payload.addressIdentifier.nickName,
    );
    if (!existing) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.addressIdentifier,
      });
    }

    const addresses = this.preserveAddresses(customer).map((a) => ({
      ...a,
      default_shipping: a.id === existing.id,
    }));

    const updated = await this.magentoApi.updateMe({ ...customer, addresses });
    return success(this.factory.parseProfile(this.context, updated));
  }

  @Reactionary({
    inputSchema: ProfileMutationSetBillingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async setBillingAddress(
    payload: ProfileMutationSetBillingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    const customer = await this.fetchCustomer();
    if (!customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const currentBilling = (customer.addresses ?? []).find(
      (a) => String(a.id) === customer.default_billing,
    );

    const collision = this.findByNickName(
      customer,
      payload.address.identifier.nickName,
    );
    if (collision && collision.id !== currentBilling?.id) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'Another address with the same nickname already exists',
      });
    }

    let addresses = this.preserveAddresses(customer);
    if (currentBilling) {
      addresses = addresses.map((a) =>
        a.id === currentBilling.id
          ? this.buildMagentoAddress(
              payload.address,
              { default_billing: true },
              currentBilling,
            )
          : a,
      );
    } else {
      addresses.push(
        this.buildMagentoAddress(payload.address, { default_billing: true }),
      );
    }

    const updated = await this.magentoApi.updateMe({ ...customer, addresses });
    return success(this.factory.parseProfile(this.context, updated));
  }

  protected preserveAddresses(customer: MagentoCustomer): MagentoAddress[] {
    return (customer.addresses ?? []).map((a) => ({
      ...a,
      default_billing: String(a.id) === customer.default_billing,
      default_shipping: String(a.id) === customer.default_shipping,
    }));
  }
}
