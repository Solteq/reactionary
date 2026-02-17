import type {
  Profile,
  ProfileMutationAddShippingAddress,
  ProfileMutationMakeShippingAddressDefault,
  ProfileMutationRemoveShippingAddress,
  ProfileMutationSetBillingAddress,
  ProfileMutationUpdate,
  ProfileQuerySelf,
  RequestContext,
  Result,
  NotFoundError,
  InvalidInputError,
  Address,
  ProfileMutationUpdateShippingAddress
} from '@reactionary/core';
import {
  ProfileMutationUpdateSchema,
  ProfileProvider,
  ProfileSchema,
  Reactionary,
  success,
  error,
  ProfileMutationSetBillingAddressSchema,
  ProfileMutationRemoveShippingAddressSchema,
  ProfileMutationAddShippingAddressSchema
} from '@reactionary/core';
import type * as z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { Cache } from '@reactionary/core';
import type { Customer, MyCustomerUpdateAction, Address as CTAddress } from '@commercetools/platform-sdk';
import type { CommercetoolsAPI } from '../core/client.js';

export class CommercetoolsProfileProvider extends ProfileProvider {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI
  ) {
    super(cache, context);

    this.config = config;
    this.commercetools = commercetools;
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  public override async getById(payload: ProfileQuerySelf): Promise<Result<Profile, NotFoundError>> {
    const client = await this.getClient();

    const remote = await client.me().get().execute();

    if (remote.body.id !== payload.identifier.userId) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const model = this.parseSingle(remote.body);
    return success(model);
  }



  @Reactionary({
    inputSchema: ProfileMutationAddShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public override async addShippingAddress(payload: ProfileMutationAddShippingAddress): Promise<Result<Profile, NotFoundError>> {
    const client = await this.getClient();

    const remote = await client.me().get().execute();
    let customer = remote.body;

    if (customer.id !== payload.identifier.userId) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const updateResponse = await client
      .me()
      .post({
        body: {
          version: customer.version,
          actions: [
            {
              action: 'addAddress',
              address: this.createCTAddressDraft(payload.address)
            }
          ] as MyCustomerUpdateAction[],
        }
      })
      .execute();
    customer = updateResponse.body;
    const model = this.parseSingle(customer);
    return success(model);
  }

  public override async updateShippingAddress(payload: ProfileMutationUpdateShippingAddress): Promise<Result<Profile, NotFoundError>> {
    const client = await this.getClient();

    const remote = await client.me().get().execute();
    let customer = remote.body;

    if (customer.id !== payload.identifier.userId) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const targetAddress = customer.addresses.find(addr => addr.key === payload.address.identifier.nickName);

    if (!targetAddress) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }


    const updateResponse = await client
      .me()
      .post({
        body: {
          version: customer.version,
          actions: [
            {
              action: 'changeAddress',
              addressId: targetAddress.id!,
              address: this.createCTAddressDraft(payload.address)
            }
          ] as MyCustomerUpdateAction[],
        }
      })
      .execute();
    customer = updateResponse.body;
    const model = this.parseSingle(customer);
    return success(model);
  }

  @Reactionary({
    inputSchema: ProfileMutationRemoveShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public override async removeShippingAddress(payload: ProfileMutationRemoveShippingAddress): Promise<Result<Profile, NotFoundError>> {
    const client = await this.getClient();

    const remote = await client.me().get().execute();
    let customer = remote.body;

    if (customer.id !== payload.identifier.userId) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const updateActions: MyCustomerUpdateAction[] = [];
    const addressToRemove = customer.addresses.find(addr => addr.key === payload.addressIdentifier.nickName);

    if (addressToRemove) {
      updateActions.push({
        action: 'removeAddress',
        addressId: addressToRemove.id!
      });
    } else {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    /**
     * if the address we remove is the default shipping address, we check to see if there are other non-billing addresses available, and make a random one
     * the new shipping  address
     */
    const needsNewDefaultShippingAddress = addressToRemove && customer.defaultShippingAddressId === addressToRemove.id;
    if (needsNewDefaultShippingAddress) {
      const newDefaultAddress = customer.addresses.find(addr => addr.id !== addressToRemove.id && addr.id !== customer.defaultBillingAddressId);
      if (newDefaultAddress) {
        updateActions.push({
          action: 'setDefaultShippingAddress',
          addressKey: newDefaultAddress.key
        });
      }
    }


    const updateResponse = await client
      .me()
      .post({
        body: {
          version: customer.version,
          actions: updateActions,
        },
      })
      .execute();
    customer = updateResponse.body;

    const model = this.parseSingle(customer);
    return success(model);
  }



  public override async makeShippingAddressDefault(payload: ProfileMutationMakeShippingAddressDefault): Promise<Result<Profile, NotFoundError>> {
    const client = await this.getClient();

    const remote = await client.me().get().execute();
    let customer = remote.body;

    if (customer.id !== payload.identifier.userId) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }
    const addressToMakeDefault = customer.addresses.find(addr => addr.key === payload.addressIdentifier.nickName);

    if (!addressToMakeDefault) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    if (addressToMakeDefault.id === customer.defaultBillingAddressId) {
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'Cannot set shipping address as default billing address'
      });
    }


    const updateResponse = await client
      .me()
      .post({
        body: {
          version: customer.version,
          actions: [
            {
              action: 'setDefaultShippingAddress',
              addressKey: addressToMakeDefault.key
            }
          ] as MyCustomerUpdateAction[],
        },
      })
      .execute();
    customer = updateResponse.body;
    const model = this.parseSingle(customer);
    return success(model);
  }


  @Reactionary({
    inputSchema: ProfileMutationSetBillingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public override async setBillingAddress(payload: ProfileMutationSetBillingAddress): Promise<Result<Profile, NotFoundError>> {
    const client = await this.getClient();

    const remote = await client.me().get().execute();
    let customer = remote.body;

    if (customer.id !== payload.identifier.userId) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const updateActions: MyCustomerUpdateAction[] = [];
    const mainAddress = customer.defaultBillingAddressId ?  customer.addresses.find(addr => addr.id === customer.defaultBillingAddressId): null;
    if (!mainAddress) {
      const newAddress = this.createCTAddressDraft(payload.address);
      updateActions.push({
        action: 'addAddress',
        address: newAddress
      });
      updateActions.push({
        action: 'setDefaultBillingAddress',
        addressKey: newAddress.key
      });
    } else {
      updateActions.push({
        action: 'changeAddress',
        addressId: mainAddress.id!,
        address: this.createCTAddressDraft( payload.address)
      });
    }

    if (updateActions.length > 0) {
      const updateResponse = await client
        .me()
        .post({
          body: {
            version: customer.version,
            actions: updateActions,
          },
        })
        .execute();
      customer = updateResponse.body;
    }
    const model = this.parseSingle(customer);
    return success(model);
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateSchema,
    outputSchema: ProfileSchema,
  })
  public override async update(payload: ProfileMutationUpdate): Promise<Result<Profile, NotFoundError>> {
    const client = await this.getClient();

    const remote = await client.me().get().execute();
    let customer = remote.body;

    if (customer.id !== payload.identifier.userId) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const updateActions: MyCustomerUpdateAction[] = [];
    if (payload.email !== undefined) {
      updateActions.push({
        action: 'changeEmail',
        email: payload.email,
      });
    }


    const mainAddress = customer.defaultBillingAddressId ?  customer.addresses.find(addr => addr.id === customer.defaultBillingAddressId): null;
    if (!mainAddress) {
      updateActions.push({
        action: 'addAddress',
        address: {
          key: `billing-address-${customer.id}`,
          email: payload.email || customer.email,
          phone: payload.phone,
          country: this.context.taxJurisdiction.countryCode
        }
      });

      updateActions.push({
        action: 'setDefaultBillingAddress',
        addressKey: `billing-address-${customer.id}`
      });
    } else {
      updateActions.push({
        action: 'changeAddress',
        addressId: mainAddress.id!,
        address: {
          ...mainAddress,
          email: payload.email || customer.email,
          phone: payload.phone
        }
      });
    }

    if (updateActions.length > 0) {
      const updateResponse = await client
        .me()
        .post({
          body: {
            version: customer.version,
            actions: updateActions,
          },
        })
        .execute();
      customer = updateResponse.body;
    }
    const model = this.parseSingle(customer);
    return success(model);

  }

  protected parseAddress(address: CTAddress): Address {
    const result = {
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

    return result;
  }

  protected parseSingle(body: Customer): Profile {
    const email = body.email;
    const emailVerified = body.isEmailVerified;
    let defaultCTBillingAddress = body.addresses.find(addr => addr.id === body.defaultBillingAddressId);
    const phone = defaultCTBillingAddress?.phone ?? '';


    // if we only have the phone number on the billing address, we dont really have a billing address, so we ignore it
    if (this.isIncompleteAddress(defaultCTBillingAddress)) {
      defaultCTBillingAddress = undefined;
    }

    const defaultCTShippingAddress = body.addresses.find(addr => addr.id === body.defaultShippingAddressId);

    const alternateShippingAddresses = body.addresses.filter(x => x.id !== body.defaultBillingAddressId && x.id !== body.defaultShippingAddressId).map(addr => this.parseAddress(addr));
    const billingAddress = defaultCTBillingAddress ? this.parseAddress(defaultCTBillingAddress) : undefined;
    const shippingAddress = defaultCTShippingAddress ? this.parseAddress(defaultCTShippingAddress) : undefined;

    const result = {
      identifier: {
        userId: body.id
      },
      email,
      emailVerified,
      alternateShippingAddresses,
      billingAddress: billingAddress,
      shippingAddress: shippingAddress,
      createdAt: body.createdAt,
      phone,
      phoneVerified: false,
      updatedAt: body.lastModifiedAt
    } satisfies Profile;

    return result;
  }

  protected createCTAddressDraft( address: Address): CTAddress {
    return {
      key: address.identifier.nickName,
      firstName: address.firstName,
      lastName: address.lastName,
      streetName: address.streetAddress,
      streetNumber: address.streetNumber,
      postalCode: address.postalCode,
      city: address.city,
      region: address.region,
      country: address.countryCode || this.context.taxJurisdiction.countryCode,
    };
  }


   /**
   * Checks if an address only contains phone information and lacks essential address fields.
   * An address is considered incomplete if it exists but has no firstName, lastName, streetName,
   * streetNumber, or city.
   * @param address - The address to check, or undefined
   * @returns true if the address exists but lacks essential fields, false otherwise (including when address is undefined)
   */
  protected isIncompleteAddress(address: CTAddress | undefined): boolean {
    if (!address) {
      return false;
    }
    return !address.firstName &&
           !address.lastName &&
           !address.streetName &&
           !address.streetNumber &&
           !address.city;
  }
}
