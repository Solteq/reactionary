import type {
  BusinessUnit,
  MyBusinessUnitUpdateAction,
  Address as CTAddress,
} from '@commercetools/platform-sdk';
import type {
  Cache,
  CompanyFactory,
  CompanyFactoryWithOutput,
  NotFoundError,
  Company,
  CompanyMutationAddShippingAddress,
  CompanyMutationMakeShippingAddressDefault,
  CompanyMutationRemoveShippingAddress,
  CompanyMutationUpdateShippingAddress,
  CompanyQueryById,
  RequestContext,
  Result,
  Address,
  CompanyPaginatedList,
  CompanyQueryList,
} from '@reactionary/core';
import {
  CompanyCapability,
  CompanySchema,
  CompanyQueryByIdSchema,
  CompanyMutationAddShippingAddressSchema,
  CompanyMutationUpdateShippingAddressSchema,
  CompanyMutationRemoveShippingAddressSchema,
  CompanyMutationMakeShippingAddressDefaultSchema,
  Reactionary,
  success,
  error,
  CompanyQueryListSchema,
  CompanyPaginatedListSchema,
} from '@reactionary/core';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsCompanyFactory } from '../factories/company/company.factory.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';

export class CommercetoolsCompanyCapability<
  TFactory extends CompanyFactory = CommercetoolsCompanyFactory,
> extends CompanyCapability {

  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: CompanyFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: CompanyFactoryWithOutput<TFactory>,
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

  protected createCTAddressDraft(address: Address): CTAddress {
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

protected async getBusinessUnit(key: string): Promise<BusinessUnit | null> {
    const client = await this.getClient();
    const response = await client
      .businessUnits()
      .withKey({ key })
      .get()
      .execute().catch((err) => {
        if (err.statusCode === 404) {
          return null;
        }
        throw err;
      });
    return response ? response.body : null;
  }

  protected async updateBusinessUnit(
    key: string,
    version: number,
    actions: MyBusinessUnitUpdateAction[],
  ): Promise<BusinessUnit> {
    const client = await this.getClient();
    const response = await client
      .businessUnits()
      .withKey({ key })
      .post({
        body: {
          version,
          actions,
        },
      })
      .execute();
    return response.body;
  }

  @Reactionary({
    inputSchema: CompanyQueryByIdSchema,
    outputSchema: CompanySchema,
  })
  public override async getById(
    payload: CompanyQueryById,
  ): Promise<Result<Company>> {
    const businessUnit = await this.getBusinessUnit(
      payload.identifier.taxIdentifier,
    );

    if(!businessUnit) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    return success(
      this.factory.parseCompany(this.context, businessUnit),
    );
  }

  protected addShippingAddressPayload(
    payload: CompanyMutationAddShippingAddress,
  ): MyBusinessUnitUpdateAction[] {
    return [
      {
        action: 'addAddress',
        address: this.createCTAddressDraft(payload.address),
      },
      {
        action: 'addShippingAddressId',
        addressKey: payload.address.identifier.nickName,
      },
    ];
  }

  @Reactionary({
    inputSchema: CompanyMutationAddShippingAddressSchema,
    outputSchema: CompanySchema,
  })
  public override async addShippingAddress(
    payload: CompanyMutationAddShippingAddress,
  ): Promise<Result<Company, NotFoundError>> {
    const key = payload.company.taxIdentifier;
    const businessUnit = await this.getBusinessUnit(key);

    if (!businessUnit) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.company,
      });
    }


    const actions = this.addShippingAddressPayload(payload);

    const updated = await this.updateBusinessUnit(
      key,
      businessUnit.version,
      actions,
    );

    return success(
      this.factory.parseCompany(this.context, updated),
    );
  }

  protected updateShippingAddressPayload(
    payload: CompanyMutationUpdateShippingAddress,
    businessUnit: BusinessUnit,
  ): MyBusinessUnitUpdateAction[] | undefined {
    const targetAddress = businessUnit.addresses.find(
      (addr) => addr.key === payload.address.identifier.nickName,
    );

    if (!targetAddress) {
      return undefined;
    }

    return [
      {
        action: 'changeAddress',
        addressId: targetAddress.id,
        address: this.createCTAddressDraft(payload.address),
      },
    ];
  }

  @Reactionary({
    inputSchema: CompanyMutationUpdateShippingAddressSchema,
    outputSchema: CompanySchema,
  })
  public override async updateShippingAddress(
    payload: CompanyMutationUpdateShippingAddress,
  ): Promise<Result<Company, NotFoundError>> {
    const key = payload.company.taxIdentifier;
    const businessUnit = await this.getBusinessUnit(key);

    if (!businessUnit) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.company,
      });
    }

    const actions = this.updateShippingAddressPayload(payload, businessUnit);
    if (!actions) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.address.identifier,
      });
    }

    const updated = await this.updateBusinessUnit(
      key,
      businessUnit.version,
      actions,
    );

    return success(
      this.factory.parseCompany(this.context, updated),
    );
  }

  protected removeShippingAddressPayload(
    payload: CompanyMutationRemoveShippingAddress,
    businessUnit: BusinessUnit,
  ): MyBusinessUnitUpdateAction[] | undefined {
    const addressToRemove = businessUnit.addresses.find(
      (addr) => addr.key === payload.addressIdentifier.nickName,
    );

    if (!addressToRemove) {
      return undefined;
    }

    const actions: MyBusinessUnitUpdateAction[] = [
      {
        action: 'removeAddress',
        addressId: addressToRemove.id,
      },
    ];

    const needsNewDefaultShippingAddress =
      businessUnit.defaultShippingAddressId === addressToRemove.id;
    if (needsNewDefaultShippingAddress) {
      const newDefault = businessUnit.addresses.find(
        (addr) =>
          addr.id !== addressToRemove.id &&
          addr.id !== businessUnit.defaultBillingAddressId,
      );
      if (newDefault) {
        actions.push({
          action: 'setDefaultShippingAddress',
          addressKey: newDefault.key,
        });
      }
    }

    return actions;
  }

  @Reactionary({
    inputSchema: CompanyMutationRemoveShippingAddressSchema,
    outputSchema: CompanySchema,
  })
  public override async removeShippingAddress(
    payload: CompanyMutationRemoveShippingAddress,
  ): Promise<Result<Company, NotFoundError>> {
    const key = payload.company.taxIdentifier;
    const businessUnit = await this.getBusinessUnit(key);
    if (!businessUnit) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.company,
      });
    }

    const actions = this.removeShippingAddressPayload(payload, businessUnit);
    if (!actions) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.addressIdentifier,
      });
    }

    const updated = await this.updateBusinessUnit(
      key,
      businessUnit.version,
      actions,
    );

    return success(
      this.factory.parseCompany(this.context, updated),
    );
  }

  protected makeShippingAddressDefaultPayload(
    payload: CompanyMutationMakeShippingAddressDefault,
    businessUnit: BusinessUnit,
  ): MyBusinessUnitUpdateAction[] | undefined {
    const addressToMakeDefault = businessUnit.addresses.find(
      (addr) => addr.key === payload.addressIdentifier.nickName,
    );

    if (!addressToMakeDefault) {
      return undefined;
    }

    return [
      {
        action: 'setDefaultShippingAddress',
        addressKey: addressToMakeDefault.key,
      },
    ];
  }

  @Reactionary({
    inputSchema: CompanyMutationMakeShippingAddressDefaultSchema,
    outputSchema: CompanySchema,
  })
  public override async makeShippingAddressDefault(
    payload: CompanyMutationMakeShippingAddressDefault,
  ): Promise<Result<Company, NotFoundError>> {
    const key = payload.company.taxIdentifier;
    const businessUnit = await this.getBusinessUnit(key);
    if (!businessUnit) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.company,
      });
    }


    const actions = this.makeShippingAddressDefaultPayload(
      payload,
      businessUnit,
    );

    if (!actions) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.addressIdentifier,
      });
    }

    const updated = await this.updateBusinessUnit(
      key,
      businessUnit.version,
      actions,
    );

    return success(
      this.factory.parseCompany(this.context, updated),
    );
  }

  protected listCompaniesPayload(
    payload: CompanyQueryList,
  ) {
      const offset = (payload.search.paginationOptions.pageNumber - 1) * payload.search.paginationOptions.pageSize;
      const limit = payload.search.paginationOptions.pageSize;
      return {
          limit: limit,
          offset: offset,
      };
  };


  @Reactionary({
    inputSchema: CompanyQueryListSchema,
    outputSchema: CompanyPaginatedListSchema,
  })
  public override async listCompanies(
    payload: CompanyQueryList,
  ): Promise<Result<CompanyPaginatedList>> {
    const client = await this.getClient();
    const response = await client
      .businessUnits()
      .get({
        queryArgs: this.listCompaniesPayload(payload)
      })
      .execute();

    return success(this.factory.parseCompanyPaginatedList(this.context, response.body, payload));
  }
}
