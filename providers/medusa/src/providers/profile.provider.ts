import type {
  InvalidInputError} from '@reactionary/core';
import {
  type Profile,
  type ProfileMutationAddShippingAddress,
  type ProfileMutationMakeShippingAddressDefault,
  type ProfileMutationRemoveShippingAddress,
  type ProfileMutationSetBillingAddress,
  type ProfileMutationUpdate,
  type ProfileMutationUpdateShippingAddress,
  type ProfileQuerySelf as ProfileQueryById,
  type RequestContext,
  type Cache,
  type Result,
  type NotFoundError,
  ProfileProvider,
  Reactionary,
  ProfileSchema,
  ProfileMutationUpdateSchema,
  ProfileMutationAddShippingAddressSchema,
  ProfileMutationUpdateShippingAddressSchema,
  ProfileMutationRemoveShippingAddressSchema,
  ProfileMutationMakeShippingAddressDefaultSchema,
  ProfileMutationSetBillingAddressSchema,
  success,
  type Address,
  ProfileQueryByIdSchema,
  error
} from '@reactionary/core';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import type { MedusaClient } from '../core/client.js';
import createDebug from 'debug';
import type { StoreCreateCustomerAddress, StoreCustomer, StoreCustomerAddress } from '@medusajs/types';

const debug = createDebug('reactionary:medusa:profile');
/**
 * Medusa Profile Provider
 *
 * Implements profile management using Medusa's customer APIs.
 *
 * TODO:
 * - handle email and phone verification status properly using metadata or other means.
 * - handle guest user scenarios (if applicable).
 * - improve error handling and edge cases.
 */
export class MedusaProfileProvider extends ProfileProvider {
  protected config: MedusaConfiguration;
  protected client: MedusaClient;
  protected includedFields = ['+metadata.*'];

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    client: MedusaClient
  ) {
    super(cache, context);

    this.config = config;
    this.client = client;
  }

  @Reactionary({
    inputSchema: ProfileQueryByIdSchema,
    outputSchema: ProfileSchema,
  })
  public async getById(payload: ProfileQueryById): Promise<Result<Profile, NotFoundError>> {
    debug('getById', payload);

    const client = await this.client.getClient();
    const customerResponse = await client.store.customer.retrieve({ fields: this.includedFields.join(',') });

    if (!customerResponse.customer) {
      return error<NotFoundError>({
        identifier: payload.identifier,
        type: 'NotFound',
      });
    }

    const model = this.parseSingle(customerResponse.customer);
    return success(model);
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateSchema,
    outputSchema: ProfileSchema,
  })
  public async update(payload: ProfileMutationUpdate): Promise<Result<Profile, NotFoundError>> {
    debug('update', payload);

    const client = await this.client.getClient();

    const customerResponse = await client.store.customer.retrieve({ fields: this.includedFields.join(',') });
    if (!customerResponse.customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const customer = customerResponse.customer;

    const updatedResponse = await client.store.customer.update({
      phone: payload.phone ?? customer.phone,
    }, { fields: this.includedFields.join(',') });

    const model = this.parseSingle(updatedResponse.customer);
    return success(model);
  }

  @Reactionary({
    inputSchema: ProfileMutationAddShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async addShippingAddress(payload: ProfileMutationAddShippingAddress): Promise<Result<Profile, NotFoundError>> {
    debug('addShippingAddress', payload);

    const client = await this.client.getClient();

    const medusaAddress = this.createMedusaAddress(payload.address);

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
        error: {
          message: 'Address with the same nickname already exists',
        }
      });
    }

    const response = await client.store.customer.createAddress(medusaAddress, { fields: this.includedFields.join(',') });
    if (!response.customer) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: {
          message: 'Failed to add shipping address',
        }
      });
    }

    const model = this.parseSingle(response.customer);
    return success(model);
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async updateShippingAddress(payload: ProfileMutationUpdateShippingAddress): Promise<Result<Profile, NotFoundError>> {
    debug('updateShippingAddress', payload);

    const client = await this.client.getClient();

    const customer = await client.store.customer.retrieve({ fields: this.includedFields.join(',') });
    if (!customer.customer) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier  ,
      });
    }

    const medusaAddress = this.createMedusaAddress(payload.address);

    const existingAddress = customer.customer.addresses.find(addr => addr.address_name === payload.address.identifier.nickName);
    if (!existingAddress) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.address.identifier
      });
    }

    const response = await client.store.customer.updateAddress(existingAddress.id, medusaAddress , { fields: this.includedFields.join(',') });
    if (!response.customer) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: {
          message: 'Failed to add shipping address',
        }
      })
    }

    const model = this.parseSingle(response.customer);
    return success(model);
  }





  @Reactionary({
    inputSchema: ProfileMutationRemoveShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async removeShippingAddress(payload: ProfileMutationRemoveShippingAddress): Promise<Result<Profile, NotFoundError>> {
    debug('removeShippingAddress', payload);
    const client = await this.client.getClient();

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
        error: {
          message: 'Failed to delete shipping address',
        }
      });
    }

    const customerAfterDelete = await client.store.customer.retrieve({ fields: this.includedFields.join(',') });

    const model = this.parseSingle(customerAfterDelete.customer!);
    return success(model);
  }


  @Reactionary({
    inputSchema: ProfileMutationMakeShippingAddressDefaultSchema,
    outputSchema: ProfileSchema,
  })
  public async makeShippingAddressDefault(payload: ProfileMutationMakeShippingAddressDefault): Promise<Result<Profile, NotFoundError>> {
    debug('makeShippingAddressDefault', payload);

    const client = await this.client.getClient();

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

    const response = await client.store.customer.updateAddress(existingAddress.id, {
      is_default_shipping: true
    }, { fields: this.includedFields.join(',') }
    );

    const model = this.parseSingle(response.customer!);
    return success(model);
  }

  @Reactionary({
    inputSchema: ProfileMutationSetBillingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async setBillingAddress(payload: ProfileMutationSetBillingAddress): Promise<Result<Profile, NotFoundError>> {
    debug('setBillingAddress', payload);


    const client = await this.client.getClient();

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
        error: {
          message: 'Another address with the same nickname already exists',
        }
      });
    }


    const newAddr = this.createMedusaAddress(payload.address);
    newAddr.is_default_billing = true;

    // two scenarios: Either we already have a billing addres, in which case we update it, or we dont and we need to create it.
    const existingBillingAddress = customer.addresses.find(addr => addr.is_default_billing);
    if (existingBillingAddress) {
      const updateAddressResponse = await client.store.customer.updateAddress(existingBillingAddress.id, newAddr, { fields: this.includedFields.join(',') });
      customer = updateAddressResponse.customer;
    } else {
      const createAddressResponse = await client.store.customer.createAddress(newAddr, { fields: this.includedFields.join(',') });
      customer = createAddressResponse.customer;
    }

    const model = this.parseSingle(customer);
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

  protected parseAddress(address: StoreCustomerAddress): Address {
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
    }
  }

  protected parseSingle(customer: StoreCustomer): Profile {
    const email = customer.email;
    const emailVerified = customer.metadata?.['email_verified'] === 'true';

    const phone = customer.phone || '';
    const phoneVerified = customer.metadata?.['phone_verified'] === 'true';

    const addresses = customer.addresses || [];
    let billingAddress: Address | undefined = undefined;
    let shippingAddress: Address | undefined = undefined;

    const existingBillingAddress = customer.addresses.find(addr => addr.is_default_billing);
    if (existingBillingAddress) {
      billingAddress = this.parseAddress(existingBillingAddress);
    }

    const existingShippingAddress = customer.addresses.find(addr => addr.is_default_shipping);
    if (existingShippingAddress) {
      shippingAddress = this.parseAddress(existingShippingAddress);
    }

    const alternateShippingAddresses: Address[] = [];

    alternateShippingAddresses.push(...addresses.filter(x => ! (x.is_default_billing || x.is_default_shipping)).map( addr => this.parseAddress(addr)));

    return {
      identifier: {
        userId: customer.id,
      },
      email,
      emailVerified,
      phone,
      phoneVerified,
      billingAddress: billingAddress,
      shippingAddress: shippingAddress,
      alternateShippingAddresses: alternateShippingAddresses,
      createdAt: new Date(customer.created_at || '').toISOString(),
      updatedAt: new Date(customer.updated_at || '').toISOString()
    } satisfies Profile;
  }



}
