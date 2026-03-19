import type { CompanyDraft, MyCompanyDraft } from '@commercetools/platform-sdk';
import type {
  Cache,
  CompanyRegistrationFactory,
  CompanyRegistrationFactoryWithOutput,
  NotFoundError,
  CompanyRegistrationMutationRegister,
  CompanyRegistrationQueryCheckRegistrationStatus,
  CompanyRegistrationRequest,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  error,
  CompanyRegistrationCapability,
  CompanyRegistrationMutationRegisterSchema,
  CompanyRegistrationQueryCheckRegistrationStatusSchema,
  CompanyRegistrationRequestSchema,
  Reactionary,
  success,
} from '@reactionary/core';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsCompanyRegistrationFactory } from '../factories/company-registration/company-registration.factory.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';

export class CommercetoolsCompanyRegistrationCapability<
  TFactory extends CompanyRegistrationFactory = CommercetoolsCompanyRegistrationFactory,
> extends CompanyRegistrationCapability {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: CompanyRegistrationFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: CompanyRegistrationFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();
    return client.withProjectKey({ projectKey: this.config.projectKey }).me();
  }

  /**
   * Extension point.
   * @param payload
   * @returns
   */
  protected registerOrganizationlEntityPayload(payload: CompanyRegistrationMutationRegister) {
    const draft: MyCompanyDraft = {
      unitType: 'Company',
      key: payload.taxIdentifier,
      name: payload.name,
      contactEmail: payload.pointOfContact.email,
      addresses: [
        {
          key: payload.billingAddress.identifier.nickName,
          country: payload.billingAddress.countryCode,
          city: payload.billingAddress.city,
          streetName: payload.billingAddress.streetAddress,
          streetNumber: payload.billingAddress.streetNumber,
          postalCode: payload.billingAddress.postalCode,
          firstName: payload.billingAddress.firstName,
          lastName: payload.billingAddress.lastName,
          region: payload.billingAddress.region,
        },
        {
          key: 'default-shipping-address',
          country: payload.billingAddress.countryCode,
          firstName: payload.billingAddress.firstName,
          lastName: payload.billingAddress.lastName,
          city: payload.billingAddress.city,
          streetName: payload.billingAddress.streetAddress,
          streetNumber: payload.billingAddress.streetNumber,
          postalCode: payload.billingAddress.postalCode,
          region: payload.billingAddress.region,
        },
      ],
      billingAddresses: [0],
      shippingAddresses: [1],
      defaultBillingAddress: 0,
      defaultShippingAddress: 1,
      custom: {
        type: {
          key: 'reactionaryOrganizationEntityRegistrationRequest',
          typeId: 'type'
        },
        fields: {
          dunsIdentifier: payload.dunsIdentifier,
          tinIdentifier: payload.tinIdentifier,
          pointOfContactPhone: payload.pointOfContact.phone,
        },
      },
    };

    return draft;
  }


  @Reactionary({
    inputSchema: CompanyRegistrationMutationRegisterSchema,
    outputSchema: CompanyRegistrationRequestSchema,
  })
  public override async requestRegistration(
    payload: CompanyRegistrationMutationRegister,
  ): Promise<Result<CompanyRegistrationRequest>> {
    const client = await this.getClient();

    if ('Registered' !== this.context.session.identityContext.identity.type) {
      return error({
        type: 'Generic',
        message: 'Only registered users can request company registration',
      });
    }


    const draft = this.registerOrganizationlEntityPayload(payload);
    const response = await client
      .businessUnits()
      .post({ body: draft })
      .execute();

    return success(this.factory.parseCompanyRegistrationRequest(this.context, response.body));
  }

  @Reactionary({
    inputSchema: CompanyRegistrationQueryCheckRegistrationStatusSchema,
    outputSchema: CompanyRegistrationRequestSchema,
  })
  public override async checkRequestStatus(
    payload: CompanyRegistrationQueryCheckRegistrationStatus,
  ): Promise<Result<CompanyRegistrationRequest>> {
    const client = await this.getClient();

    if ('Registered' !== this.context.session.identityContext.identity.type) {
      return error({
        type: 'Generic',
        message: 'Only registered users can check company registration status',
      });
    }

    const response = await client
      .businessUnits()
      .withId({ ID: payload.requestIdentifier.key })
      .get()
      .execute().catch((error) => {
        if (error?.code === "404") {
          return null;
        }
        throw error;
      });

    if (!response) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.requestIdentifier
      })
    }
    return success(this.factory.parseCompanyRegistrationRequest(this.context, response.body));
  }
}
