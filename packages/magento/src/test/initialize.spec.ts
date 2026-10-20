import {
  CompanyPaginatedListSchema,
  CompanySchema,
  NoOpCache,
  createInitialRequestContext,
  type StoreFactory,
} from '@reactionary/core';
import { describe, expect, it } from 'vitest';
import { MagentoCompanyCapability } from '../capabilities/company.capability.js';
import { MagentoCompanyRegistrationCapability } from '../capabilities/company-registration.capability.js';
import { MagentoEmployeeCapability } from '../capabilities/employee.capability.js';
import { MagentoEmployeeInvitationCapability } from '../capabilities/employee-invitation.capability.js';
import { MagentoPersonalizationProfileCapability } from '../capabilities/personalization-profile.capability.js';
import { MagentoProductListCapability } from '../capabilities/product-list.capability.js';
import { MagentoStoreCapability } from '../capabilities/store.capability.js';
import { withMagentoCapabilities } from '../core/initialize.js';
import { MagentoCompanyFactory } from '../factories/company/company.factory.js';
import type { MagentoStoreFactory } from '../factories/store/store.factory.js';
import type { MagentoConfigurationInput } from '../schema/configuration.schema.js';

const configuration: MagentoConfigurationInput = {
  adminApiKey: 'token',
  baseUrl: 'https://example.com',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
};

class CustomCompanyFactory extends MagentoCompanyFactory {}

class CustomStoreCapability<
  TFactory extends StoreFactory = MagentoStoreFactory,
> extends MagentoStoreCapability<TFactory> {
  public readonly custom = true;
}

describe('withMagentoCapabilities', () => {
  it('builds each new capability when it is enabled', () => {
    const client = withMagentoCapabilities(configuration, {
      productList: { enabled: true },
      store: { enabled: true },
      personalizationProfile: { enabled: true },
      company: { enabled: true },
      companyRegistration: { enabled: true },
      employee: { enabled: true },
      employeeInvitation: { enabled: true },
    })(new NoOpCache(), createInitialRequestContext());

    expect(client.productList).toBeInstanceOf(MagentoProductListCapability);
    expect(client.store).toBeInstanceOf(MagentoStoreCapability);
    expect(client.personalizationProfile).toBeInstanceOf(
      MagentoPersonalizationProfileCapability,
    );
    expect(client.company).toBeInstanceOf(MagentoCompanyCapability);
    expect(client.companyRegistration).toBeInstanceOf(MagentoCompanyRegistrationCapability);
    expect(client.employee).toBeInstanceOf(MagentoEmployeeCapability);
    expect(client.employeeInvitation).toBeInstanceOf(MagentoEmployeeInvitationCapability);
  });

  it('leaves out capabilities that are disabled or not configured', () => {
    const client = withMagentoCapabilities(configuration, {
      company: { enabled: false },
      employee: { enabled: true },
    })(new NoOpCache(), createInitialRequestContext());

    expect(client.employee).toBeInstanceOf(MagentoEmployeeCapability);
    expect('company' in client).toBe(false);
    expect('employeeInvitation' in client).toBe(false);
    expect('productList' in client).toBe(false);
    expect('store' in client).toBe(false);
  });

  it('honours a custom factory and a custom capability', () => {
    const factory = new CustomCompanyFactory(CompanySchema, CompanyPaginatedListSchema);
    const client = withMagentoCapabilities(configuration, {
      company: { enabled: true, factory },
      store: {
        enabled: true,
        capability: (args) =>
          new CustomStoreCapability(
            args.config,
            args.cache,
            args.context,
            args.magentoApi,
            args.factory,
          ),
      },
    })(new NoOpCache(), createInitialRequestContext());

    expect(client.company).toBeInstanceOf(MagentoCompanyCapability);
    expect(Reflect.get(client.company, 'factory')).toBe(factory);
    expect(client.store).toBeInstanceOf(CustomStoreCapability);
  });
});
