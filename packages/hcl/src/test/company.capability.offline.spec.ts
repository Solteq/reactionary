import {
  CompanyPaginatedListSchema,
  CompanySchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { assert, describe, expect, it, vi } from 'vitest';
import { HclCompanyCapability } from '../capabilities/company.capability.js';
import { HclCompanyFactory } from '../factories/index.js';
import { HclClient } from '../core/client.js';
import { HclConfigurationSchema } from '../schema/configuration.schema.js';
import type {
  HclOrganizationItem,
  HclOrganizationListResponse,
} from '../schema/hcl.schema.js';

// Offline (mocked) tests: these go through the @Reactionary decorator, which
// validates the returned value against each method's outputSchema, so a schema
// that does not match the returned model surfaces as an InvalidOutput error.
describe('HCL Company Capability (offline)', () => {
  const org: HclOrganizationItem = {
    organizationId: '1001',
    organizationName: 'Acme',
    taxPayerId: 'acme-tax-id',
    contactInfo: { email1: 'billing@acme.example' },
    addressBook: [
      { nickName: 'hq', firstName: 'Ada', lastName: 'Lovelace', primary: '1' },
      { nickName: 'depot', firstName: 'Bob', lastName: 'Builder' },
    ],
  };

  const company = { taxIdentifier: 'acme-tax-id' };

  function buildProvider() {
    const reqCtx = createInitialRequestContext();
    // A static configuration: these tests never leave the mocked client.
    const config = HclConfigurationSchema.parse({
      apiUrl: 'https://hcl.example.com/wcs/resources',
      searchApiUrl: 'https://hcl.example.com/search/resources',
      storeId: '41',
    });
    const client = new HclClient(config, reqCtx);
    vi.spyOn(client, 'callGet').mockResolvedValue(org);
    vi.spyOn(client, 'callPut').mockResolvedValue({});
    const provider = new HclCompanyCapability(
      new NoOpCache(),
      reqCtx,
      config,
      client,
      new HclCompanyFactory(CompanySchema, CompanyPaginatedListSchema),
    );
    return { provider, client };
  }

  it('getById returns a single company', async () => {
    const result = await buildProvider().provider.getById({ identifier: company });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.identifier.taxIdentifier).toBe('acme-tax-id');
    expect(result.value.alternateShippingAddresses).toHaveLength(2);
  });

  it('addShippingAddress returns the updated company', async () => {
    const result = await buildProvider().provider.addShippingAddress({
      company,
      address: {
        identifier: { nickName: 'new' },
        firstName: 'Cy',
        lastName: 'Dee',
        streetAddress: 'Main St',
        streetNumber: '1',
        city: 'Helsinki',
        region: '',
        postalCode: '00100',
        countryCode: 'FI',
      },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.identifier.taxIdentifier).toBe('acme-tax-id');
  });

  it('updateShippingAddress returns the updated company', async () => {
    const result = await buildProvider().provider.updateShippingAddress({
      company,
      address: {
        identifier: { nickName: 'depot' },
        firstName: 'Bob',
        lastName: 'Builder',
        streetAddress: 'Side St',
        streetNumber: '2',
        city: 'Espoo',
        region: '',
        postalCode: '02100',
        countryCode: 'FI',
      },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.identifier.taxIdentifier).toBe('acme-tax-id');
  });

  it('removeShippingAddress returns the updated company', async () => {
    const result = await buildProvider().provider.removeShippingAddress({
      company,
      addressIdentifier: { nickName: 'depot' },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.identifier.taxIdentifier).toBe('acme-tax-id');
  });

  it('makeShippingAddressDefault returns the updated company', async () => {
    const result = await buildProvider().provider.makeShippingAddressDefault({
      company,
      addressIdentifier: { nickName: 'depot' },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.identifier.taxIdentifier).toBe('acme-tax-id');
  });

  it('listCompanies returns a paginated list', async () => {
    const { provider, client } = buildProvider();
    vi.spyOn(client, 'callGet').mockResolvedValue({
      organizationDataBeans: [org],
      recordSetTotal: '1',
    } satisfies HclOrganizationListResponse);

    const result = await provider.listCompanies({
      search: { paginationOptions: { pageNumber: 1, pageSize: 10 } },
    });

    assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
    expect(result.value.items).toHaveLength(1);
    expect(result.value.totalCount).toBe(1);
  });
});
