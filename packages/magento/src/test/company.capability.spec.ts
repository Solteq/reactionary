import {
  CompanyPaginatedListSchema,
  CompanyRegistrationRequestSchema,
  CompanySchema,
  NoOpCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { describe, expect, it, vi } from 'vitest';
import { MagentoCompanyRegistrationCapability } from '../capabilities/company-registration.capability.js';
import { MagentoCompanyCapability } from '../capabilities/company.capability.js';
import type { MagentoClient, MagentoGraphQLRequestOptions } from '../core/client.js';
import { createRegistrationKey } from '../core/company.api.js';
import { MagentoApiError } from '../core/errors.js';
import { MagentoCompanyRegistrationFactory } from '../factories/company-registration/company-registration.factory.js';
import {
  MagentoCompanyFactory,
  type MagentoCompanyIdentifier,
} from '../factories/company/company.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const config: MagentoConfiguration = {
  adminApiKey: 'admin-secret',
  baseUrl: 'https://example.com',
  mediaSource: 'DEFAULT',
  defaultCurrency: 'EUR',
  rootCategoryId: '2',
  allCurrencies: ['EUR'],
  storeBaseCode: 'default',
  authStoreCode: 'default',
};

const COMPANY = {
  id: 'Mw==',
  name: 'Acme',
  legal_name: 'Acme Ltd',
  email: 'office@acme.test',
  vat_tax_id: 'DK12345678',
  reseller_id: null,
  legal_address: {
    street: ['Main Street', '12'],
    city: 'Copenhagen',
    postcode: '1000',
    country_code: 'DK',
    telephone: '+4512345678',
    region: { region: 'Hovedstaden', region_code: '84', region_id: null },
  },
  company_admin: { id: 'Mg==', email: 'boss@acme.test', firstname: 'Bo', lastname: 'Boss' },
};

const OTHER_COMPANY = {
  ...COMPANY,
  id: 'NA==',
  name: 'Globex',
  legal_name: 'Globex Inc',
  vat_tax_id: 'SE5566778899',
};

const COMPANIES_BY_UID: Record<string, typeof COMPANY> = {
  'Mw==': COMPANY,
  'NA==': OTHER_COMPANY,
};

function operationName(document: string): string {
  return /(?:query|mutation)\s+(\w+)/.exec(document)?.[1] ?? '';
}

function graphqlError(category: string, message = 'GraphQL error'): MagentoApiError {
  return new MagentoApiError({
    transport: 'graphql',
    status: 200,
    method: 'POST',
    url: 'https://example.com/graphql',
    graphqlErrors: [{ message, extensions: { category } }],
  });
}

function companyHeader(options?: MagentoGraphQLRequestOptions): string | undefined {
  return options?.headers?.['X-Adobe-Company'];
}

type GraphqlHandler = (
  variables?: Record<string, unknown>,
  options?: MagentoGraphQLRequestOptions,
) => unknown;

function createMagentoApi(handlers: Record<string, GraphqlHandler>) {
  return {
    graphqlRequest: vi.fn(
      async (
        document: string,
        variables?: Record<string, unknown>,
        options?: MagentoGraphQLRequestOptions,
      ) => {
        const handler = handlers[operationName(document)];
        if (!handler) {
          throw new Error(`Unexpected GraphQL operation ${operationName(document)}`);
        }
        return handler(variables, options);
      },
    ),
    adminRequest: vi.fn(),
  };
}

type MagentoApiMock = ReturnType<typeof createMagentoApi>;

function callsOf(magentoApi: MagentoApiMock, operation: string) {
  return magentoApi.graphqlRequest.mock.calls.filter(
    ([document]) => operationName(document) === operation,
  );
}

/** `Customer.companies` with the given entries, all on one page. */
function customerCompanies(...items: Array<{ id: string; status: string; name?: string }>) {
  return () => ({
    customer: {
      companies: {
        items,
        page_info: { current_page: 1, page_size: 50, total_pages: items.length > 0 ? 1 : 0 },
      },
    },
  });
}

/** `company` resolved in the context named by `X-Adobe-Company`. */
const companyInContext: GraphqlHandler = (_variables, options) => {
  const uid = companyHeader(options);
  return { company: (uid ? COMPANIES_BY_UID[uid] : COMPANY) ?? null };
};

/** Magento before 2.4.7: no `Customer.companies`. */
const companiesUnavailable: GraphqlHandler = () => {
  throw graphqlError('graphql', 'Cannot query field "companies" on type "Customer".');
};

/** Magento without the company address book (on-premises). */
const addressBookUnavailable: GraphqlHandler = () => {
  throw graphqlError('graphql', 'Cannot query field "config" on type "Company".');
};

function address(overrides: Record<string, unknown>) {
  return {
    id: 'MTI=',
    nickname: 'HQ',
    company_id: 'Mw==',
    address_type: 'SHIPPING',
    is_default: false,
    firstname: 'Jane',
    lastname: 'Smith',
    company: 'Acme',
    street: ['Dock Road', '7'],
    city: 'Aarhus',
    country_code: 'DK',
    region_id: null,
    region: { region: 'Midtjylland', region_code: '82', region_id: null },
    postcode: '8000',
    telephone: '+4587654321',
    ...overrides,
  };
}

function addressBook(
  addresses: Array<ReturnType<typeof address>>,
  settings: { enabled?: boolean; custom?: boolean } = {},
): GraphqlHandler {
  return () => ({
    company: {
      id: 'Mw==',
      config: {
        address_book_enabled: settings.enabled ?? true,
        address_book_custom_shipping_address_enabled: settings.custom ?? false,
      },
      addresses: {
        total_count: addresses.length,
        page_info: { current_page: 1, page_size: 100, total_pages: 1 },
        items: addresses,
      },
    },
  });
}

const WAREHOUSE = {
  identifier: { nickName: 'Warehouse' },
  firstName: 'A',
  lastName: 'B',
  streetAddress: 'Dock',
  streetNumber: '1',
  city: 'Aarhus',
  region: '82',
  postalCode: '8000',
  countryCode: 'DK',
};

const DK_REGIONS = () => ({
  country: { available_regions: [{ id: 82, code: '82', name: 'Midtjylland' }] },
});

describe('MagentoCompanyCapability', () => {
  const context = createInitialRequestContext();
  const factory = new MagentoCompanyFactory(CompanySchema, CompanyPaginatedListSchema);
  const list = (pageNumber = 1, pageSize = 20) => ({
    search: { paginationOptions: { pageNumber, pageSize } },
  });

  function createCapability(handlers: Record<string, GraphqlHandler>) {
    const magentoApi = createMagentoApi({
      ReactionaryCompanyAddresses: addressBookUnavailable,
      ...handlers,
    });
    const capability = new MagentoCompanyCapability(
      config,
      new NoOpCache(),
      context,
      magentoApi as unknown as MagentoClient,
      factory,
    );
    return { capability, magentoApi };
  }

  describe('reading companies', () => {
    it('maps a company matched by its VAT id, read in its own context', async () => {
      const { capability, magentoApi } = createCapability({
        ReactionaryCompany: companyInContext,
        ReactionaryCustomerCompanies: customerCompanies({ id: 'Mw==', status: 'APPROVED' }),
      });

      const result = await capability.getById({ identifier: { taxIdentifier: 'DK12345678' } });

      if (!result.success) throw new Error(JSON.stringify(result.error));
      expect(result.value.identifier).toEqual({ taxIdentifier: 'DK12345678', key: 'Mw==' });
      expect(result.value.name).toBe('Acme');
      expect(result.value.status).toBe('active');
      expect(result.value.pointOfContact).toEqual({ email: 'office@acme.test', phone: '+4512345678' });
      expect(result.value.billingAddress).toMatchObject({
        streetAddress: 'Main Street',
        streetNumber: '12',
        city: 'Copenhagen',
        postalCode: '1000',
        countryCode: 'DK',
        region: '84',
      });
      expect(result.value.shippingAddress).toBeUndefined();
      expect(result.value.alternateShippingAddresses).toEqual([]);
      expect(result.value.isCustomAddressesAllowed).toBe(true);
      expect(result.value.isSelfManagementOfShippingAddressesAllowed).toBe(false);
      expect(companyHeader(callsOf(magentoApi, 'ReactionaryCompany')[0]?.[2])).toBe('Mw==');
    });

    it('reads another company of the customer by its uid key, with X-Adobe-Company', async () => {
      const { capability, magentoApi } = createCapability({
        ReactionaryCompany: companyInContext,
        ReactionaryCustomerCompanies: customerCompanies(
          { id: 'Mw==', status: 'APPROVED' },
          { id: 'NA==', status: 'BLOCKED' },
        ),
      });

      const identifier: MagentoCompanyIdentifier = { taxIdentifier: 'anything', key: 'NA==' };
      const result = await capability.getById({ identifier });

      if (!result.success) throw new Error(JSON.stringify(result.error));
      expect(result.value.name).toBe('Globex');
      expect(result.value.status).toBe('blocked');
      const companyCalls = callsOf(magentoApi, 'ReactionaryCompany');
      expect(companyCalls).toHaveLength(1);
      expect(companyHeader(companyCalls[0]?.[2])).toBe('NA==');
      expect(companyHeader(callsOf(magentoApi, 'ReactionaryCompanyAddresses')[0]?.[2])).toBe('NA==');
    });

    it('returns NotFound for a company the customer does not belong to', async () => {
      const { capability, magentoApi } = createCapability({
        ReactionaryCompany: companyInContext,
        ReactionaryCustomerCompanies: customerCompanies({ id: 'Mw==', status: 'APPROVED' }),
      });

      const unknownKey: MagentoCompanyIdentifier = { taxIdentifier: 'x', key: 'OQ==' };
      const byKey = await capability.getById({ identifier: unknownKey });
      expect(byKey.success).toBe(false);
      if (!byKey.success) expect(byKey.error.type).toBe('NotFound');
      // A key is decisive: no company is loaded to compare VAT ids.
      expect(callsOf(magentoApi, 'ReactionaryCompany')).toHaveLength(0);

      const byVat = await capability.getById({ identifier: { taxIdentifier: 'SE999' } });
      expect(byVat.success).toBe(false);
      if (!byVat.success) expect(byVat.error.type).toBe('NotFound');
    });

    it('reports a company Magento will not resolve in its context, and leaves it out of the list', async () => {
      const { capability } = createCapability({
        ReactionaryCompany: (variables, options) => {
          if (companyHeader(options) === 'NA==') {
            throw graphqlError('graphql-authorization', 'The current customer isn\'t authorized.');
          }
          return companyInContext(variables, options);
        },
        ReactionaryCustomerCompanies: customerCompanies(
          { id: 'Mw==', status: 'APPROVED' },
          { id: 'NA==', status: 'PENDING', name: 'Globex' },
        ),
      });

      const identifier: MagentoCompanyIdentifier = { taxIdentifier: 'x', key: 'NA==' };
      const result = await capability.getById({ identifier });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('Generic');

      const listed = await capability.listCompanies(list());
      if (!listed.success) throw new Error(JSON.stringify(listed.error));
      expect(listed.value.totalCount).toBe(1);
      expect(listed.value.items.map((c) => c.name)).toEqual(['Acme']);
    });

    it('uses the current company when Customer.companies is unavailable (pre-2.4.7)', async () => {
      const { capability, magentoApi } = createCapability({
        ReactionaryCompany: companyInContext,
        ReactionaryCustomerCompanies: companiesUnavailable,
      });

      const result = await capability.getById({ identifier: { taxIdentifier: 'DK12345678' } });

      if (!result.success) throw new Error(JSON.stringify(result.error));
      expect(result.value.status).toBe('active');
      expect(callsOf(magentoApi, 'ReactionaryCompany')[0]?.[2]).toBeUndefined();
      expect(callsOf(magentoApi, 'ReactionaryCompanyAddresses')).toHaveLength(0);
    });

    it('returns a Generic error for a customer outside any company', async () => {
      const { capability } = createCapability({
        ReactionaryCompany: () => ({ company: null }),
        ReactionaryCustomerCompanies: customerCompanies(),
      });

      const result = await capability.getById({ identifier: { taxIdentifier: 'DK12345678' } });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('Generic');
    });

    it('maps a GraphQL authorization failure to a Generic error', async () => {
      const { capability } = createCapability({
        ReactionaryCustomerCompanies: () => {
          throw graphqlError('graphql-authorization', 'The current customer isn\'t authorized.');
        },
      });

      const result = await capability.getById({ identifier: { taxIdentifier: 'DK12345678' } });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('Generic');
    });

    it('lists every company of the customer, each read in its own context', async () => {
      const { capability, magentoApi } = createCapability({
        ReactionaryCompany: companyInContext,
        ReactionaryCustomerCompanies: customerCompanies(
          { id: 'Mw==', status: 'APPROVED' },
          { id: 'NA==', status: 'APPROVED' },
        ),
      });

      const result = await capability.listCompanies(list());

      if (!result.success) throw new Error(JSON.stringify(result.error));
      expect(result.value.totalCount).toBe(2);
      expect(result.value.totalPages).toBe(1);
      expect(result.value.items.map((c) => c.name)).toEqual(['Acme', 'Globex']);
      expect(
        callsOf(magentoApi, 'ReactionaryCompany').map(([, , options]) => companyHeader(options)),
      ).toEqual(['Mw==', 'NA==']);
    });

    it('pages the list and only reads the address books on the requested page', async () => {
      const { capability, magentoApi } = createCapability({
        ReactionaryCompany: companyInContext,
        // Magento pages Customer.companies itself: two pages of one.
        ReactionaryCustomerCompanies: (variables) => {
          const page = variables?.['currentPage'];
          return {
            customer: {
              companies: {
                items: [page === 1 ? { id: 'Mw==', status: 'APPROVED' } : { id: 'NA==', status: 'APPROVED' }],
                page_info: { current_page: page, page_size: 1, total_pages: 2 },
              },
            },
          };
        },
      });

      const result = await capability.listCompanies(list(2, 1));

      if (!result.success) throw new Error(JSON.stringify(result.error));
      expect(result.value.totalCount).toBe(2);
      expect(result.value.totalPages).toBe(2);
      expect(result.value.items.map((c) => c.name)).toEqual(['Globex']);
      expect(callsOf(magentoApi, 'ReactionaryCustomerCompanies')).toHaveLength(2);
      expect(callsOf(magentoApi, 'ReactionaryCompanyAddresses')).toHaveLength(1);
      expect(companyHeader(callsOf(magentoApi, 'ReactionaryCompanyAddresses')[0]?.[2])).toBe('NA==');
    });

    it('lists the current company only when Customer.companies is unavailable', async () => {
      const { capability } = createCapability({
        ReactionaryCompany: companyInContext,
        ReactionaryCustomerCompanies: companiesUnavailable,
      });

      const result = await capability.listCompanies(list());

      if (!result.success) throw new Error(JSON.stringify(result.error));
      expect(result.value.totalCount).toBe(1);
      expect(result.value.items.map((c) => c.name)).toEqual(['Acme']);
    });

    it('lists no companies for a customer outside any company', async () => {
      const { capability } = createCapability({
        ReactionaryCompany: () => ({ company: null }),
        ReactionaryCustomerCompanies: customerCompanies(),
      });

      const result = await capability.listCompanies(list());

      if (!result.success) throw new Error(JSON.stringify(result.error));
      expect(result.value.totalCount).toBe(0);
      expect(result.value.items).toEqual([]);
    });

    it('does not mistake other GraphQL errors for a missing Customer.companies', async () => {
      const { capability } = createCapability({
        ReactionaryCustomerCompanies: () => {
          throw graphqlError('graphql', 'Cannot query field "foo" on type "Customer".');
        },
      });

      const result = await capability.listCompanies(list());

      expect(result.success).toBe(false);
    });
  });

  describe('company address book', () => {
    const base = {
      ReactionaryCompany: companyInContext,
      ReactionaryCustomerCompanies: customerCompanies({ id: 'Mw==', status: 'APPROVED' }),
      ReactionaryCountryRegions: DK_REGIONS,
    };
    const company = { taxIdentifier: 'DK12345678' };

    it('maps the default and alternate shipping addresses and the settings', async () => {
      const { capability } = createCapability({
        ...base,
        ReactionaryCompanyAddresses: addressBook(
          [
            address({ id: 'MTI=', nickname: 'HQ', is_default: true }),
            address({ id: 'MTM=', nickname: null, city: 'Odense' }),
            address({
              id: 'MTQ=',
              nickname: 'Billing',
              address_type: 'BILLING',
              is_default: true,
              street: ['Invoice Lane'],
              city: 'Aalborg',
            }),
          ],
          { enabled: true, custom: false },
        ),
      });

      const result = await capability.getById({ identifier: company });

      if (!result.success) throw new Error(JSON.stringify(result.error));
      expect(result.value.shippingAddress).toMatchObject({
        identifier: { nickName: 'HQ' },
        firstName: 'Jane',
        streetAddress: 'Dock Road',
        streetNumber: '7',
        region: '82',
      });
      expect(result.value.alternateShippingAddresses).toEqual([
        expect.objectContaining({ identifier: { nickName: 'MTM=' }, city: 'Odense' }),
      ]);
      expect(result.value.billingAddress).toMatchObject({
        identifier: { nickName: 'Billing' },
        streetAddress: 'Invoice Lane',
        city: 'Aalborg',
      });
      expect(result.value.isCustomAddressesAllowed).toBe(false);
      expect(result.value.isSelfManagementOfShippingAddressesAllowed).toBe(true);
    });

    it('adds a shipping address in the company context', async () => {
      const { capability, magentoApi } = createCapability({
        ...base,
        ReactionaryCompanyAddresses: addressBook([address({ is_default: true })]),
        ReactionaryCreateCompanyAddress: (variables) => ({
          createCompanyAddress: address({ id: 'MTU=', nickname: 'Warehouse', ...variables }),
        }),
      });

      const result = await capability.addShippingAddress({ company, address: WAREHOUSE });

      if (!result.success) throw new Error(JSON.stringify(result.error));
      const [call] = callsOf(magentoApi, 'ReactionaryCreateCompanyAddress');
      expect(companyHeader(call?.[2])).toBe('Mw==');
      expect(call?.[1]).toEqual({
        input: {
          address_type: 'SHIPPING',
          is_default: false,
          nickname: 'Warehouse',
          firstname: 'A',
          lastname: 'B',
          company: 'Acme',
          street: ['Dock', '1'],
          city: 'Aarhus',
          country_code: 'DK',
          region: { region: 'Midtjylland', region_code: '82', region_id: 82 },
          postcode: '8000',
          telephone: '+4512345678',
        },
      });
    });

    it('rejects a duplicate nickname and an unknown region', async () => {
      const { capability, magentoApi } = createCapability({
        ...base,
        ReactionaryCompanyAddresses: addressBook([address({ nickname: 'Warehouse' })]),
      });

      const duplicate = await capability.addShippingAddress({ company, address: WAREHOUSE });
      expect(duplicate.success).toBe(false);
      if (!duplicate.success) expect(duplicate.error.type).toBe('InvalidInput');

      const unknownRegion = await capability.addShippingAddress({
        company,
        address: { ...WAREHOUSE, identifier: { nickName: 'Depot' }, region: 'Atlantis' },
      });
      expect(unknownRegion.success).toBe(false);
      if (!unknownRegion.success) expect(unknownRegion.error.type).toBe('InvalidInput');
      expect(callsOf(magentoApi, 'ReactionaryCreateCompanyAddress')).toHaveLength(0);
    });

    it('updates an existing shipping address and keeps its default flag', async () => {
      const { capability, magentoApi } = createCapability({
        ...base,
        ReactionaryCompanyAddresses: addressBook([address({ nickname: 'Warehouse', is_default: true })]),
        ReactionaryUpdateCompanyAddress: () => ({ updateCompanyAddress: address({}) }),
      });

      const result = await capability.updateShippingAddress({ company, address: WAREHOUSE });

      if (!result.success) throw new Error(JSON.stringify(result.error));
      const [call] = callsOf(magentoApi, 'ReactionaryUpdateCompanyAddress');
      expect(companyHeader(call?.[2])).toBe('Mw==');
      expect(call?.[1]).toMatchObject({
        id: 'MTI=',
        input: { is_default: true, nickname: 'Warehouse', telephone: '+4587654321', city: 'Aarhus' },
      });
      expect(call?.[1]?.['input']).not.toHaveProperty('address_type');

      const missing = await capability.updateShippingAddress({
        company,
        address: { ...WAREHOUSE, identifier: { nickName: 'Nowhere' } },
      });
      expect(missing.success).toBe(false);
      if (!missing.success) expect(missing.error.type).toBe('NotFound');
    });

    it('removes the default shipping address and promotes another one', async () => {
      const { capability, magentoApi } = createCapability({
        ...base,
        ReactionaryCompanyAddresses: addressBook([
          address({ id: 'MTI=', nickname: 'HQ', is_default: true }),
          address({ id: 'MTM=', nickname: 'Depot' }),
        ]),
        ReactionaryDeleteCompanyAddress: () => ({ deleteCompanyAddress: true }),
        ReactionarySetDefaultCompanyAddress: () => ({ setDefaultCompanyAddress: address({ id: 'MTM=' }) }),
      });

      const result = await capability.removeShippingAddress({
        company,
        addressIdentifier: { nickName: 'HQ' },
      });

      if (!result.success) throw new Error(JSON.stringify(result.error));
      expect(callsOf(magentoApi, 'ReactionaryDeleteCompanyAddress')[0]?.[1]).toEqual({ id: 'MTI=' });
      expect(callsOf(magentoApi, 'ReactionarySetDefaultCompanyAddress')[0]?.[1]).toEqual({ id: 'MTM=' });
    });

    it('makes a shipping address the default', async () => {
      const { capability, magentoApi } = createCapability({
        ...base,
        ReactionaryCompanyAddresses: addressBook([address({ id: 'MTM=', nickname: 'Depot' })]),
        ReactionarySetDefaultCompanyAddress: () => ({ setDefaultCompanyAddress: address({ id: 'MTM=' }) }),
      });

      const result = await capability.makeShippingAddressDefault({
        company,
        addressIdentifier: { nickName: 'Depot' },
      });

      if (!result.success) throw new Error(JSON.stringify(result.error));
      const [call] = callsOf(magentoApi, 'ReactionarySetDefaultCompanyAddress');
      expect(call?.[1]).toEqual({ id: 'MTM=' });
      expect(companyHeader(call?.[2])).toBe('Mw==');
    });

    it('reports the address book as not supported on an on-premises edition', async () => {
      const { capability, magentoApi } = createCapability(base);

      const result = await capability.addShippingAddress({ company, address: WAREHOUSE });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('Generic');
        expect(JSON.stringify(result.error)).toContain(
          'addShippingAddress is not supported by the Magento provider on this Adobe Commerce edition',
        );
      }
      expect(callsOf(magentoApi, 'ReactionaryCreateCompanyAddress')).toHaveLength(0);
    });

    it('reports the address book as not supported before Adobe Commerce 2.4.7', async () => {
      const { capability, magentoApi } = createCapability({
        ...base,
        ReactionaryCustomerCompanies: companiesUnavailable,
      });

      const result = await capability.removeShippingAddress({
        company,
        addressIdentifier: { nickName: 'HQ' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain('not supported by the Magento provider');
      }
      expect(callsOf(magentoApi, 'ReactionaryCompanyAddresses')).toHaveLength(0);
    });

    it('reports a mutation Magento does not know as not supported', async () => {
      const { capability } = createCapability({
        ...base,
        ReactionaryCompanyAddresses: addressBook([address({ id: 'MTM=', nickname: 'Depot' })]),
        ReactionarySetDefaultCompanyAddress: () => {
          throw graphqlError('graphql', 'Cannot query field "setDefaultCompanyAddress" on type "Mutation".');
        },
      });

      const result = await capability.makeShippingAddressDefault({
        company,
        addressIdentifier: { nickName: 'Depot' },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain(
          'makeShippingAddressDefault is not supported by the Magento provider on this Adobe Commerce edition',
        );
      }
    });

    it('refuses to change a disabled address book', async () => {
      const { capability, magentoApi } = createCapability({
        ...base,
        ReactionaryCompanyAddresses: addressBook([], { enabled: false }),
      });

      const result = await capability.addShippingAddress({ company, address: WAREHOUSE });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('Generic');
      expect(callsOf(magentoApi, 'ReactionaryCreateCompanyAddress')).toHaveLength(0);
    });
  });
});

describe('MagentoCompanyRegistrationCapability', () => {
  const context = createInitialRequestContext();
  const factory = new MagentoCompanyRegistrationFactory(CompanyRegistrationRequestSchema);

  function createCapability(handlers: Record<string, GraphqlHandler>) {
    const magentoApi = createMagentoApi(handlers);
    const capability = new MagentoCompanyRegistrationCapability(
      config,
      new NoOpCache(),
      context,
      magentoApi as unknown as MagentoClient,
      factory,
    );
    return { capability, magentoApi };
  }

  const registration = {
    taxIdentifier: 'US-123',
    name: 'Initech',
    pointOfContact: { email: 'peter@initech.test', phone: '5551234' },
    billingAddress: {
      identifier: { nickName: 'hq' },
      firstName: 'Peter',
      lastName: 'Gibbons',
      streetAddress: 'Initech Way',
      streetNumber: '1',
      city: 'Austin',
      region: 'tx',
      postalCode: '73301',
      countryCode: 'US',
    },
  };

  it('creates a pending company and hands out a signed request key', async () => {
    const { capability, magentoApi } = createCapability({
      ReactionaryCountryRegions: () => ({
        country: { available_regions: [{ id: 57, code: 'TX', name: 'Texas' }] },
      }),
      ReactionaryCreateCompany: () => ({
        createCompany: {
          company: {
            id: 'Nw==',
            name: 'Initech',
            email: 'peter@initech.test',
            vat_tax_id: 'US-123',
            legal_address: { telephone: '5551234' },
          },
        },
      }),
    });

    const result = await capability.requestRegistration(registration);

    if (!result.success) throw new Error(JSON.stringify(result.error));
    expect(result.value.status).toBe('pending');
    expect(result.value.identifier.key).toBe(createRegistrationKey('admin-secret', '7'));
    expect(result.value.companyIdentifier).toEqual({ taxIdentifier: 'US-123', key: 'Nw==' });

    const createCall = magentoApi.graphqlRequest.mock.calls.find(
      ([document]) => operationName(document) === 'ReactionaryCreateCompany',
    );
    expect(createCall?.[1]).toEqual({
      input: {
        company_name: 'Initech',
        legal_name: 'Initech',
        company_email: 'peter@initech.test',
        vat_tax_id: 'US-123',
        company_admin: {
          email: 'peter@initech.test',
          firstname: 'Peter',
          lastname: 'Gibbons',
          telephone: '5551234',
        },
        legal_address: {
          street: ['Initech Way', '1'],
          city: 'Austin',
          region: { region: 'Texas', region_code: 'TX', region_id: 57 },
          postcode: '73301',
          country_id: 'US',
          telephone: '5551234',
        },
      },
    });
  });

  it('requires a telephone', async () => {
    const { capability, magentoApi } = createCapability({});

    const result = await capability.requestRegistration({
      ...registration,
      pointOfContact: { email: 'peter@initech.test' },
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('InvalidInput');
    expect(magentoApi.graphqlRequest).not.toHaveBeenCalled();
  });

  it('rejects a region the country does not know', async () => {
    const { capability } = createCapability({
      ReactionaryCountryRegions: () => ({
        country: { available_regions: [{ id: 57, code: 'TX', name: 'Texas' }] },
      }),
    });

    const result = await capability.requestRegistration({
      ...registration,
      billingAddress: { ...registration.billingAddress, region: 'Atlantis' },
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('InvalidInput');
  });

  it('reads the approval status of a signed request through the admin API', async () => {
    const { capability, magentoApi } = createCapability({});
    magentoApi.adminRequest.mockResolvedValue({
      id: 7,
      status: 2,
      company_name: 'Initech',
      company_email: 'peter@initech.test',
      vat_tax_id: 'US-123',
      telephone: '5551234',
      reject_reason: 'Missing documents',
    });
    const key = createRegistrationKey('admin-secret', '7');

    const result = await capability.checkRequestStatus({ requestIdentifier: { key } });

    if (!result.success) throw new Error(JSON.stringify(result.error));
    expect(magentoApi.adminRequest).toHaveBeenCalledWith('GET', '/V1/company/7');
    expect(result.value.status).toBe('denied');
    expect(result.value.comment).toBe('Missing documents');
    expect(result.value.companyIdentifier).toEqual({ taxIdentifier: 'US-123', key: 'Nw==' });
  });

  it('maps an approved company', async () => {
    const { capability, magentoApi } = createCapability({});
    magentoApi.adminRequest.mockResolvedValue({
      id: 7,
      status: 1,
      company_name: 'Initech',
      company_email: 'peter@initech.test',
    });

    const result = await capability.checkRequestStatus({
      requestIdentifier: { key: createRegistrationKey('admin-secret', '7') },
    });

    if (!result.success) throw new Error(JSON.stringify(result.error));
    expect(result.value.status).toBe('approved');
  });

  it('never looks up an unsigned or forged key', async () => {
    const { capability, magentoApi } = createCapability({});

    for (const key of ['7', '7.forged', createRegistrationKey('other-secret', '7'), '../7.x']) {
      const result = await capability.checkRequestStatus({ requestIdentifier: { key } });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('NotFound');
    }
    expect(magentoApi.adminRequest).not.toHaveBeenCalled();
  });

  it('returns NotFound when the company no longer exists', async () => {
    const { capability, magentoApi } = createCapability({});
    magentoApi.adminRequest.mockRejectedValue(
      new MagentoApiError({
        transport: 'rest',
        status: 404,
        method: 'GET',
        url: 'https://example.com/rest/default/V1/company/7',
      }),
    );

    const result = await capability.checkRequestStatus({
      requestIdentifier: { key: createRegistrationKey('admin-secret', '7') },
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('NotFound');
  });
});
