import {
  ProfileMutationAddShippingAddressSchema,
  ProfileMutationMakeShippingAddressDefaultSchema,
  ProfileMutationRemoveShippingAddressSchema,
  ProfileMutationSetBillingAddressSchema,
  ProfileMutationUpdateSchema,
  ProfileMutationUpdateShippingAddressSchema,
  ProfileProvider,
  ProfileQueryByIdSchema,
  ProfileSchema,
  Reactionary,
  type Cache,
  type IdentityIdentifier,
  type NotFoundError,
  type Profile,
  type ProfileMutationAddShippingAddress,
  type ProfileMutationMakeShippingAddressDefault,
  type ProfileMutationRemoveShippingAddress,
  type ProfileMutationSetBillingAddress,
  type ProfileMutationUpdate,
  type ProfileMutationUpdateShippingAddress,
  type ProfileQuerySelf,
  type RequestContext,
  type Result,
  success,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';

export class FakeProfileProvider extends ProfileProvider {
  protected config: FakeConfiguration;
  private generator: Faker;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext
  ) {
    super(cache, context);
    this.generator = new Faker({
      locale: [en, base],
      seed: config.seeds.product,
    });
    this.config = config;
  }

  @Reactionary({
    inputSchema: ProfileQueryByIdSchema,
    outputSchema: ProfileSchema,
  })
  public override async getById(
    payload: ProfileQuerySelf
  ): Promise<Result<Profile, NotFoundError>> {
    const profile = this.composeBaseProfile(payload.identifier);

    return success(profile);
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateSchema,
    outputSchema: ProfileSchema,
  })
  public override async update(
    payload: ProfileMutationUpdate
  ): Promise<Result<Profile, NotFoundError>> {
    const profile = this.composeBaseProfile(payload.identifier);

    return success(profile);
  }

  @Reactionary({
    inputSchema: ProfileMutationAddShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public override async addShippingAddress(
    payload: ProfileMutationAddShippingAddress
  ): Promise<Result<Profile, NotFoundError>> {
    const profile = this.composeBaseProfile(payload.identifier);

    return success(profile);
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public override async updateShippingAddress(
    payload: ProfileMutationUpdateShippingAddress
  ): Promise<Result<Profile, NotFoundError>> {
    const profile = this.composeBaseProfile(payload.identifier);

    return success(profile);
  }

  @Reactionary({
    inputSchema: ProfileMutationRemoveShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public override async removeShippingAddress(
    payload: ProfileMutationRemoveShippingAddress
  ): Promise<Result<Profile, NotFoundError>> {
    const profile = this.composeBaseProfile(payload.identifier);

    return success(profile);
  }

  @Reactionary({
    inputSchema: ProfileMutationMakeShippingAddressDefaultSchema,
    outputSchema: ProfileSchema,
  })
  public override async makeShippingAddressDefault(
    payload: ProfileMutationMakeShippingAddressDefault
  ): Promise<Result<Profile, NotFoundError>> {
    const profile = this.composeBaseProfile(payload.identifier);

    return success(profile);
  }

  @Reactionary({
    inputSchema: ProfileMutationSetBillingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public override async setBillingAddress(
    payload: ProfileMutationSetBillingAddress
  ): Promise<Result<Profile, NotFoundError>> {
    const profile = this.composeBaseProfile(payload.identifier);

    return success(profile);
  }

  protected composeBaseProfile(identifier?: IdentityIdentifier) {
    const profile = {
      alternateShippingAddresses: [],
      createdAt: this.generator.date.past().toISOString(),
      email: this.generator.internet.email(),
      emailVerified: true,
      identifier: identifier || {
        userId: this.generator.string.uuid(),
      },
      phone: this.generator.phone.number(),
      phoneVerified: true,
      updatedAt: this.generator.date.past().toISOString(),
    } satisfies Profile;

    return profile;
  }
}
