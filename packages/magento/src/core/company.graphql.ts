/**
 * Adobe Commerce B2B GraphQL documents for the company, company registration,
 * employee and employee invitation capabilities.
 *
 * Every query starts from the root `company` field, which resolves the
 * company of the signed-in customer (the "current company context"). Adobe
 * Commerce 2.4.7+ lets a customer belong to several companies
 * (`Customer.companies`) and selects one with the `X-Adobe-Company` request
 * header (see `MagentoCompanyApi`); without it, Magento uses the customer's
 * default company.
 *
 * The company address book (`Company.addresses`, `Company.config` and the
 * `*CompanyAddress` mutations) belongs to the B2B Storefront Compatibility
 * Package of Adobe Commerce as a Cloud Service. Those documents are kept apart
 * from the base company query so an on-premises Magento, which rejects them as
 * unknown fields, can still read the company itself.
 */

const COMPANY_FIELDS = `
  id
  name
  legal_name
  email
  vat_tax_id
  reseller_id
  legal_address {
    street
    city
    postcode
    country_code
    telephone
    region {
      region
      region_code
      region_id
    }
  }
  company_admin {
    id
    email
    firstname
    lastname
  }
`;

const COMPANY_USER_FIELDS = `
  id
  email
  firstname
  lastname
  job_title
  telephone
  status
  role {
    id
    name
  }
`;

export const COMPANY_QUERY = `
  query ReactionaryCompany {
    company {
${COMPANY_FIELDS}
    }
  }
`;

/**
 * The companies the customer belongs to (Adobe Commerce 2.4.7+). The output
 * (`UserCompaniesOutput`) has no `total_count`, only `page_info`.
 */
export const CUSTOMER_COMPANIES_QUERY = `
  query ReactionaryCustomerCompanies($pageSize: Int!, $currentPage: Int!) {
    customer {
      companies(input: { pageSize: $pageSize, currentPage: $currentPage }) {
        items {
          id
          name
          legal_name
          status
        }
        page_info {
          current_page
          page_size
          total_pages
        }
      }
    }
  }
`;

const COMPANY_ADDRESS_FIELDS = `
  id
  nickname
  company_id
  address_type
  is_default
  firstname
  lastname
  company
  street
  city
  country_code
  region_id
  region {
    region_id
    region
    region_code
  }
  postcode
  telephone
`;

/** The company address book and its settings (Adobe Commerce as a Cloud Service). */
export const COMPANY_ADDRESSES_QUERY = `
  query ReactionaryCompanyAddresses($pageSize: Int!, $currentPage: Int!) {
    company {
      id
      config {
        address_book_enabled
        address_book_custom_shipping_address_enabled
      }
      addresses(pageSize: $pageSize, currentPage: $currentPage) {
        total_count
        page_info {
          current_page
          page_size
          total_pages
        }
        items {
${COMPANY_ADDRESS_FIELDS}
        }
      }
    }
  }
`;

export const CREATE_COMPANY_ADDRESS_MUTATION = `
  mutation ReactionaryCreateCompanyAddress($input: CompanyAddressInput!) {
    createCompanyAddress(input: $input) {
${COMPANY_ADDRESS_FIELDS}
    }
  }
`;

export const UPDATE_COMPANY_ADDRESS_MUTATION = `
  mutation ReactionaryUpdateCompanyAddress($id: ID!, $input: CompanyAddressUpdateInput!) {
    updateCompanyAddress(id: $id, input: $input) {
${COMPANY_ADDRESS_FIELDS}
    }
  }
`;

export const DELETE_COMPANY_ADDRESS_MUTATION = `
  mutation ReactionaryDeleteCompanyAddress($id: ID!) {
    deleteCompanyAddress(id: $id)
  }
`;

export const SET_DEFAULT_COMPANY_ADDRESS_MUTATION = `
  mutation ReactionarySetDefaultCompanyAddress($id: ID!) {
    setDefaultCompanyAddress(id: $id) {
${COMPANY_ADDRESS_FIELDS}
    }
  }
`;

export const COMPANY_USERS_QUERY = `
  query ReactionaryCompanyUsers(
    $pageSize: Int!
    $currentPage: Int!
    $status: CompanyUserStatusEnum
  ) {
    company {
${COMPANY_FIELDS}
      users(filter: { status: $status }, pageSize: $pageSize, currentPage: $currentPage) {
        items {
${COMPANY_USER_FIELDS}
        }
        total_count
      }
    }
  }
`;

export const COMPANY_USER_QUERY = `
  query ReactionaryCompanyUser($id: ID!) {
    company {
${COMPANY_FIELDS}
      user(id: $id) {
${COMPANY_USER_FIELDS}
      }
    }
  }
`;

export const COMPANY_ROLES_QUERY = `
  query ReactionaryCompanyRoles($pageSize: Int!, $currentPage: Int!) {
    company {
      id
      roles(pageSize: $pageSize, currentPage: $currentPage) {
        items {
          id
          name
        }
      }
    }
  }
`;

export const COUNTRY_REGIONS_QUERY = `
  query ReactionaryCountryRegions($id: String!) {
    country(id: $id) {
      available_regions {
        id
        code
        name
      }
    }
  }
`;

export const CREATE_COMPANY_MUTATION = `
  mutation ReactionaryCreateCompany($input: CompanyCreateInput!) {
    createCompany(input: $input) {
      company {
${COMPANY_FIELDS}
      }
    }
  }
`;

export const CREATE_COMPANY_USER_MUTATION = `
  mutation ReactionaryCreateCompanyUser($input: CompanyUserCreateInput!) {
    createCompanyUser(input: $input) {
      user {
${COMPANY_USER_FIELDS}
      }
    }
  }
`;

export const UPDATE_COMPANY_USER_MUTATION = `
  mutation ReactionaryUpdateCompanyUser($input: CompanyUserUpdateInput!) {
    updateCompanyUser(input: $input) {
      user {
${COMPANY_USER_FIELDS}
      }
    }
  }
`;

export const DELETE_COMPANY_USER_MUTATION = `
  mutation ReactionaryDeleteCompanyUser($id: ID!) {
    deleteCompanyUserV2(id: $id) {
      success
    }
  }
`;

export const ACCEPT_COMPANY_INVITATION_MUTATION = `
  mutation ReactionaryAcceptCompanyInvitation($input: CompanyInvitationInput!) {
    acceptCompanyInvitation(input: $input) {
      success
    }
  }
`;
