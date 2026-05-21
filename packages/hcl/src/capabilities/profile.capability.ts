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
  type ProfileQuerySelf,
  ProfileQueryByIdSchema,
  ProfileSchema,
  Reactionary,
  type RequestContext,
  type Result,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclProfileFactory } from '../factories/profile/profile.factory.js';
import type {
  HclPersonResponse,
  HclWcsPersonContact,
} from '../schema/hcl.schema.js';

const debug = createDebug('reactionary:hcl:profile');

/** NickName used to store the billing address in the WCS contact list. */
const BILLING_NICK_NAME = 'Billing';

export class HclProfileCapability<
  TFactory extends ProfileFactory = HclProfileFactory,
> extends ProfileCapability<ProfileFactoryOutput<TFactory>> {
  protected config: HclConfiguration;
  protected client: HclClient;
  protected factory: ProfileFactoryWithOutput<TFactory>;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: HclConfiguration,
    client: HclClient,
    factory: ProfileFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.client = client;
    this.factory = factory;
  }

  protected async fetchPerson(): Promise<HclPersonResponse> {
    return this.client.callGet<HclPersonResponse>(this.personSelfUrl());
  }

  protected async fetchProfile(): Promise<ProfileFactoryOutput<TFactory>> {
    const person = await this.fetchPerson();
    return this.factory.parseProfile(this.context, person);
  }

  protected toWcsContact(address: Address): Partial<HclWcsPersonContact> {
    const lines = [address.streetAddress, address.streetNumber].filter(Boolean);
    return {
      nickName: address.identifier.nickName,
      firstName: address.firstName,
      lastName: address.lastName,
      addressLine: lines.length ? lines : undefined,
      city: address.city,
      stateOrProvinceName: address.region,
      zipCode: address.postalCode,
      country: address.countryCode,
    };
  }

  protected personSelfUrl(): string {
    return `${this.client.transactionBaseUrl}/person/@self`;
  }

  protected updatePersonPayload(
    email?: string,
    phone?: string,
  ): { email1?: string; phone1?: string } {
    return { email1: email, phone1: phone };
  }

  protected personContactListUrl(): string {
    return `${this.client.transactionBaseUrl}/person/@self/contact`;
  }

  protected contactUrl(nickName: string): string {
    return `${this.client.transactionBaseUrl}/person/@self/contact/${encodeURIComponent(nickName)}`;
  }

  protected makeShippingAddressDefaultPayload(): { primary: string } {
    return { primary: '1' };
  }

  @Reactionary({
    inputSchema: ProfileQueryByIdSchema,
    outputSchema: ProfileSchema,
  })
  public async getById(
    _payload: ProfileQuerySelf,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    debug('getById');
    return success(await this.fetchProfile());
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateSchema,
    outputSchema: ProfileSchema,
  })
  public async update(
    payload: ProfileMutationUpdate,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    debug('update %o', payload.identifier);
    await this.client.callPut<HclPersonResponse>(
      this.personSelfUrl(),
      this.updatePersonPayload(payload.email, payload.phone),
    );
    return success(await this.fetchProfile());
  }

  @Reactionary({
    inputSchema: ProfileMutationAddShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async addShippingAddress(
    payload: ProfileMutationAddShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    debug('addShippingAddress %s', payload.address.identifier.nickName);
    await this.client.callPost<unknown>(
      this.personContactListUrl(),
      this.toWcsContact(payload.address),
    );
    return success(await this.fetchProfile());
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async updateShippingAddress(
    payload: ProfileMutationUpdateShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    debug('updateShippingAddress %s', payload.address.identifier.nickName);
    try {
      await this.client.callPut<unknown>(
        this.contactUrl(payload.address.identifier.nickName),
        this.toWcsContact(payload.address),
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload.address.identifier,
        });
      }
      throw err;
    }
    return success(await this.fetchProfile());
  }

  @Reactionary({
    inputSchema: ProfileMutationRemoveShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async removeShippingAddress(
    payload: ProfileMutationRemoveShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    debug('removeShippingAddress %s', payload.addressIdentifier.nickName);
    try {
      await this.client.callDelete(
        this.contactUrl(payload.addressIdentifier.nickName),
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload.addressIdentifier,
        });
      }
      throw err;
    }
    return success(await this.fetchProfile());
  }

  @Reactionary({
    inputSchema: ProfileMutationMakeShippingAddressDefaultSchema,
    outputSchema: ProfileSchema,
  })
  public async makeShippingAddressDefault(
    payload: ProfileMutationMakeShippingAddressDefault,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    debug('makeShippingAddressDefault %s', payload.addressIdentifier.nickName);
    try {
      await this.client.callPut<unknown>(
        this.contactUrl(payload.addressIdentifier.nickName),
        this.makeShippingAddressDefaultPayload(),
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload.addressIdentifier,
        });
      }
      throw err;
    }
    return success(await this.fetchProfile());
  }

  @Reactionary({
    inputSchema: ProfileMutationSetBillingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async setBillingAddress(
    payload: ProfileMutationSetBillingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    debug('setBillingAddress');
    const person = await this.fetchPerson();
    const billingContact = (person.contact ?? []).find(
      (c) => c.nickName === BILLING_NICK_NAME,
    );
    const contactData = {
      ...this.toWcsContact(payload.address),
      nickName: BILLING_NICK_NAME,
    };

    if (billingContact) {
      await this.client.callPut<unknown>(
        this.contactUrl(BILLING_NICK_NAME),
        contactData,
      );
    } else {
      await this.client.callPost<unknown>(
        this.personContactListUrl(),
        contactData,
      );
    }
    return success(await this.fetchProfile());
  }
}
