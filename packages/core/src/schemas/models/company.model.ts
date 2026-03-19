import * as z from 'zod';
import { CompanyIdentifierSchema, CompanySearchIdentifierSchema, EmployeeSearchIdentifierSchema } from './identifiers.model.js';
import { createPaginatedResponseSchema, ImageSchema, PointOfContactSchema } from './base.model.js';
import { AddressSchema } from './profile.model.js';
import type { InferType } from '../../zod-utils.js';
import { EmployeeSchema } from './employee.model.js';

/**
 * Status of a company in the system. This can be used to determine if the company is active and allowed to perform certain actions, or if it is pending approval or blocked due to violations of terms of service or other issues.
 */
export const CompanyStatusSchema = z.enum(['active', 'blocked']);
export const CompanySchema = z.looseObject({
  identifier: CompanyIdentifierSchema,

  /**
   * DUN and Bradstreet identifier. Useful for doing automated credit checks
   */
  dunsIdentifier: z.string().optional().meta({ description: 'The DUNS number of the company. This is a unique identifier for businesses that can be used for credit reporting and other purposes.' }),

  /**
   * EU Tax identifier. Useful for reporting and printing
   */
  tinIdentifier: z.string().optional().meta({ description: 'The TIN (Tax Identification Number) of the company. This is a unique identifier for tax purposes.' }),


  name: z.string().meta({ description: 'The name of the company. This is the human readable name that will be displayed in the UI.' }),
  logo: ImageSchema.optional().meta({ description: 'The logo of the company. This is the image that will be displayed in the UI to represent the company.'  }),

  /**
   * future
  parentCompany: CompanyIdentifierSchema.optional(),
  childOrganizationalEntities: z.array(CompanyIdentifierSchema).optional()
   */
  status: CompanyStatusSchema.default('blocked').meta({ description: 'The current status of the company in the system. This can be used to determine if the company is active and allowed to perform certain actions, or if it is pending approval or blocked due to violations of terms of service or other issues.' }),

  /**
   * The legal contact point for this company. Might not be someone with an actual profile on the site.
   */
  pointOfContact: PointOfContactSchema.meta({ description: 'Email and optional phone for the CFO / signatory of the company' }),

  /**
   * Default shipping address if different from default billing address
   */
  shippingAddress: AddressSchema.optional().meta({ description: 'The default shipping address for the company. This can be used as the default shipping address for orders placed by this company.' }),

  /**
   * The billing address for this company.
   */
  billingAddress: AddressSchema.meta({ description: 'The billing address for this company. Not user editable.'}),

  /**
   * Other allowed shipping addresses
   */
  alternateShippingAddresses: z.array(AddressSchema).default(() => []).meta({ description: 'Other approved shipping addresses for this company'}),

  /**
   * Various indicators the merchant can use to indicate what the company can self-manage.
   */

  /**
   * Can user type in a different shipping address at checkout?
   */
  isCustomAddressesAllowed: z.boolean().default(false).meta({ description: 'Whether the company allows using custom shipping addresses that are not in the address book. If false, the user must select from the address book when placing an order.' }),

  /**
   * Can admin users manage the address book of the company, adding and removing shipping addresses as needed?
   */
  isSelfManagementOfShippingAddressesAllowed: z.boolean().default(false).meta({ description: 'Whether the company allows users to manage their own shipping addresses in an address book. If false, the user must contact support to add or update shipping addresses.' }),
});


export const CompanyPaginatedListSchema = createPaginatedResponseSchema(CompanySchema).extend({
    identifier: CompanySearchIdentifierSchema
});


export type CompanyPaginatedList = InferType<typeof CompanyPaginatedListSchema>;

export type Company = InferType<typeof CompanySchema>;
