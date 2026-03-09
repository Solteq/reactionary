import {
  AddressSchema,
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
  type Address,
  type IdentityIdentifier,
  type NotFoundError,
  type Profile,
  type ProfileFactory,
  type ProfileFactoryOutput,
  type ProfileFactoryWithOutput,
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
import type { FakeProfileFactory } from '../factories/profile/profile.factory.js';

export class FakeProfileProvider<
  TFactory extends ProfileFactory = FakeProfileFactory,
> extends ProfileProvider<ProfileFactoryOutput<TFactory>> {
  protected config: FakeConfiguration;
  protected factory: ProfileFactoryWithOutput<TFactory>;
  private generator: Faker;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: ProfileFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.generator = new Faker({
      locale: [en, base],
      seed: config.seeds.product,
    });
    this.config = config;
    this.factory = factory;
  }

  @Reactionary({ inputSchema: ProfileQueryByIdSchema, outputSchema: ProfileSchema })
  public override async getById(
    payload: ProfileQuerySelf,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    return success(this.composeProfile(payload.identifier));
  }

  @Reactionary({ inputSchema: ProfileMutationUpdateSchema, outputSchema: ProfileSchema })
  public override async update(
    payload: ProfileMutationUpdate,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    return success(this.composeProfile(payload.identifier));
  }

  @Reactionary({
    inputSchema: ProfileMutationAddShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public override async addShippingAddress(
    payload: ProfileMutationAddShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    return success(this.composeProfile(payload.identifier));
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public override async updateShippingAddress(
    payload: ProfileMutationUpdateShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    return success(this.composeProfile(payload.identifier));
  }

  @Reactionary({
    inputSchema: ProfileMutationRemoveShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public override async removeShippingAddress(
    payload: ProfileMutationRemoveShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    return success(this.composeProfile(payload.identifier));
  }

  @Reactionary({
    inputSchema: ProfileMutationMakeShippingAddressDefaultSchema,
    outputSchema: ProfileSchema,
  })
  public override async makeShippingAddressDefault(
    payload: ProfileMutationMakeShippingAddressDefault,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    return success(this.composeProfile(payload.identifier));
  }

  @Reactionary({
    inputSchema: ProfileMutationSetBillingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public override async setBillingAddress(
    payload: ProfileMutationSetBillingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    return success(this.composeProfile(payload.identifier));
  }

  protected composeProfile(identifier: IdentityIdentifier): ProfileFactoryOutput<TFactory> {
    const baseProfile = {
      identifier,
      email: this.generator.internet.email(),
      phone: this.generator.phone.number(),
      emailVerified: true,
      phoneVerified: true,
      createdAt: this.generator.date.past().toISOString(),
      updatedAt: this.generator.date.recent().toISOString(),
      billingAddress: this.createEmptyAddress(),
      shippingAddress: this.createEmptyAddress(),
      alternateShippingAddresses: [],
    } satisfies Profile;

    return this.factory.parseProfile(this.context, baseProfile);
  }

  protected createEmptyAddress(): Address {
    return AddressSchema.parse({
      identifier: {
        nickName: this.generator.person.firstName().toLowerCase(),
      },
      firstName: this.generator.person.firstName(),
      lastName: this.generator.person.lastName(),
      streetAddress: this.generator.location.street(),
      streetNumber: this.generator.location.buildingNumber(),
      city: this.generator.location.city(),
      region: this.generator.location.state(),
      postalCode: this.generator.location.zipCode(),
      countryCode: this.generator.location.countryCode('alpha-2'),
    });
  }
}
