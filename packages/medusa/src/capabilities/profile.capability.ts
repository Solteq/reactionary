import type { StoreCreateCustomerAddress } from '@medusajs/types';
import type {
  InvalidInputError
} from '@reactionary/core';
import {
  type Address,
  type Cache,
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
  success
} from '@reactionary/core';
import createDebug from 'debug';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaProfileFactory } from '../factories/profile/profile.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

const debug = createDebug('reactionary:medusa:profile');
/**
 * Medusa Profile Capability
 *
 * Implements profile management using Medusa's customer APIs.
 *
 * TODO:
 * - handle email and phone verification status properly using metadata or other means.
 * - handle guest user scenarios (if applicable).
 * - improve error handling and edge cases.
 */
export class MedusaProfileCapability<
  TFactory extends ProfileFactory = MedusaProfileFactory,
> extends ProfileCapability<ProfileFactoryOutput<TFactory>> {
  protected config: MedusaConfiguration;
  protected includedFields = ['+metadata.*'];
  protected factory: ProfileFactoryWithOutput<TFactory>;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: ProfileFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: ProfileQueryByIdSchema,
    outputSchema: ProfileSchema,
  })
  public async getById(
    payload: ProfileQueryById,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    debug('getById', payload);

    const client = await this.medusaApi.getClient();
    const customerResponse = await client.store.customer.retrieve({ fields: this.includedFields.join(',') });

    if (!customerResponse.customer) {
      return error<NotFoundError>({
        identifier: payload.identifier,
        type: 'NotFound',
      });
    }

    const model = this.factory.parseProfile(this.context, customerResponse.customer);
    return success(model);
  }

  protected updatePayload(payload: ProfileMutationUpdate) {
    const updateData: any = {};
    if (payload.phone !== undefined) {
      updateData.phone = payload.phone;
    }
    return updateData;
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateSchema,
    outputSchema: ProfileSchema,
  })
  public async update(
    payload: ProfileMutationUpdate,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    debug('update', payload);

    const client = await this.medusaApi.getClient();

    const customerResponse = await client.store.customer.retrieve({ fields: this.includedFields.join(',') });
    if (!customerResponse.customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const customer = customerResponse.customer;

    const updatedResponse = await client.store.customer.update(this.updatePayload(payload), { fields: this.includedFields.join(',') });

    const model = this.factory.parseProfile(this.context, updatedResponse.customer!);
    return success(model);
  }

  protected addShippingAddressPayload(payload: ProfileMutationAddShippingAddress) {
    return this.createMedusaAddress(payload.address);
  }

  @Reactionary({
    inputSchema: ProfileMutationAddShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async addShippingAddress(
    payload: ProfileMutationAddShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    debug('addShippingAddress', payload);

    const client = await this.medusaApi.getClient();


    // check if any address with the same nickName exists
    const customer = await client.store.customer.retrieve({ fields: this.includedFields.join(',') });
    if (!customer.customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }
    const existingAddress = customer.customer.addresses.find(addr => addr.address_name === payload.address.identifier.nickName);
    if (existingAddress) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'Address with the same nickname already exists'
      });
    }

    const response = await client.store.customer.createAddress(this.addShippingAddressPayload(payload), { fields: this.includedFields.join(',') });
    if (!response.customer) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'Failed to add shipping address'
      });
    }

    const model = this.factory.parseProfile(this.context, response.customer!);
    return success(model);
  }

  protected updateShippingAddressPayload(payload: ProfileMutationUpdateShippingAddress) {
    return this.createMedusaAddress(payload.address);
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async updateShippingAddress(
    payload: ProfileMutationUpdateShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    debug('updateShippingAddress', payload);

    const client = await this.medusaApi.getClient();

    const customer = await client.store.customer.retrieve({ fields: this.includedFields.join(',') });
    if (!customer.customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier  ,
      });
    }

    const existingAddress = customer.customer.addresses.find(addr => addr.address_name === payload.address.identifier.nickName);
    if (!existingAddress) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.address.identifier
      });
    }

    const response = await client.store.customer.updateAddress(existingAddress.id, this.updateShippingAddressPayload(payload), { fields: this.includedFields.join(',') });
    if (!response.customer) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'Failed to add shipping address'
      })
    }

    const model = this.factory.parseProfile(this.context, response.customer!);
    return success(model);
  }





  @Reactionary({
    inputSchema: ProfileMutationRemoveShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async removeShippingAddress(
    payload: ProfileMutationRemoveShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    debug('removeShippingAddress', payload);
    const client = await this.medusaApi.getClient();

    const customer = await client.store.customer.retrieve({ fields: this.includedFields.join(',') });
    if (!customer.customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }
    const existingAddress = customer.customer.addresses.find(addr => addr.address_name === payload.addressIdentifier.nickName);
    if (!existingAddress) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.addressIdentifier,
      });
    }

    const response = await client.store.customer.deleteAddress(existingAddress.id,{ fields: this.includedFields.join(',') });
    if (!response.deleted) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'Failed to delete shipping address'
      });
    }

    const customerAfterDelete = await client.store.customer.retrieve({ fields: this.includedFields.join(',') });

    const model = this.factory.parseProfile(this.context, customerAfterDelete.customer!);
    return success(model);
  }


  protected makeShippingAddressDefaultPayload(payload: ProfileMutationMakeShippingAddressDefault) {
   return  {
      is_default_shipping: true
    }
  }

  @Reactionary({
    inputSchema: ProfileMutationMakeShippingAddressDefaultSchema,
    outputSchema: ProfileSchema,
  })
  public async makeShippingAddressDefault(
    payload: ProfileMutationMakeShippingAddressDefault,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    debug('makeShippingAddressDefault', payload);

    const client = await this.medusaApi.getClient();

    const customer = await client.store.customer.retrieve({ fields: this.includedFields.join(',') });
    if (!customer.customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }
    const existingAddress = customer.customer.addresses.find(addr => addr.address_name === payload.addressIdentifier.nickName);

    if (!existingAddress) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.addressIdentifier ,
      });
    }

    const response = await client.store.customer.updateAddress(
      existingAddress.id,
      this.makeShippingAddressDefaultPayload(payload),
      { fields: this.includedFields.join(',') }
    );

    const model = this.factory.parseProfile(this.context, response.customer!);
    return success(model);
  }


  protected setBillingAddressPayload(payload: ProfileMutationSetBillingAddress) {
    const newAddr = this.createMedusaAddress(payload.address);
    newAddr.is_default_billing = true;
    return newAddr;
  }

  @Reactionary({
    inputSchema: ProfileMutationSetBillingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async setBillingAddress(
    payload: ProfileMutationSetBillingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    debug('setBillingAddress', payload);


    const client = await this.medusaApi.getClient();

    const customerResponse = await client.store.customer.retrieve({ fields: this.includedFields.join(',') });
    if (!customerResponse.customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }
    let customer = customerResponse.customer;

    // check that this nickname is not used by another address
    const existingAddressWithNickname = customer.addresses.find(addr => addr.address_name === payload.address.identifier.nickName);
    if (existingAddressWithNickname && !existingAddressWithNickname.is_default_billing) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'Another address with the same nickname already exists'
      });
    }




    const newAddr = this.setBillingAddressPayload(payload);
    // two scenarios: Either we already have a billing addres, in which case we update it, or we dont and we need to create it.
    const existingBillingAddress = customer.addresses.find(addr => addr.is_default_billing);
    if (existingBillingAddress) {
      const updateAddressResponse = await client.store.customer.updateAddress(existingBillingAddress.id, newAddr, { fields: this.includedFields.join(',') });
      customer = updateAddressResponse.customer;
    } else {
      const createAddressResponse = await client.store.customer.createAddress(newAddr, { fields: this.includedFields.join(',') });
      customer = createAddressResponse.customer;
    }

    const model = this.factory.parseProfile(this.context, customer);
    return success(model);
  }

  protected createMedusaAddress(address: Address): StoreCreateCustomerAddress {
    return {
      address_name: address.identifier.nickName,
      first_name: address.firstName,
      last_name: address.lastName,
      address_1: address.streetAddress,
      address_2: address.streetNumber,
      city: address.city,
      province: address.region,
      postal_code: address.postalCode,
      country_code: address.countryCode,
    } satisfies StoreCreateCustomerAddress;
  }
}
