import * as z from 'zod';
import { OrganizationalEntityIdentifierSchema, OrganizationalEntityRegistrationStatusIdentifierSchema } from './identifiers.model.js';
import { ImageSchema, PointOfContactSchema } from './base.model.js';
import { AddressSchema } from './profile.model.js';
import type { InferType } from '../../zod-utils.js';

/**
 * Status of an organization/company/business/volunteer organization in the system. This can be used to determine if the organization is active and allowed to perform certain actions, or if it is pending approval or blocked due to violations of terms of service or other issues.
 */
export const OrganizationalEntityStatusSchema = z.enum(['pending', 'approved', 'blocked']);
export const OrganizationalEntitySchema = z.looseObject({
  identifier: OrganizationalEntityIdentifierSchema,

  /**
   * DUN and Bradstreet identifier. Useful for doing automated credit checks
   */
  dunsIdentifier: z.string().optional().meta({ description: 'The DUNS number of the organizational entity. This is a unique identifier for businesses that can be used for credit reporting and other purposes.' }),

  /**
   * EU Tax identifier. Useful for reporting and printing
   */
  tinIdentifier: z.string().optional().meta({ description: 'The TIN (Tax Identification Number) of the organizational entity. This is a unique identifier for tax purposes.' }),


  name: z.string().meta({ description: 'The name of the organizational entity. This is the human readable name that will be displayed in the UI.' }),
  logo: ImageSchema.optional().meta({ description: 'The logo of the organizational entity. This is the image that will be displayed in the UI to represent the organizational entity.'  }),

  /**
   * future
  parentOrganizationalEntity: OrganizationalEntityIdentifierSchema.optional(),
  childOrganizationalEntities: z.array(OrganizationalEntityIdentifierSchema).optional()
   */
  status: OrganizationalEntityStatusSchema.default('pending').meta({ description: 'The current status of the organization in the system. This can be used to determine if the organization is active and allowed to perform certain actions, or if it is pending approval or blocked due to violations of terms of service or other issues.' }),

  /**
   * The legal contact point for this organizational entity. Might not be someone with an actual profile on the site.
   */
  pointOfContact: PointOfContactSchema.meta({ description: 'Email and optional phone for the CFO / signatory of the organizational entity' }),

  /**
   * Default shipping address if different from default billing address
   */
  shippingAddress: AddressSchema.optional().meta({ description: 'The default shipping address for the organizational entity. This can be used as the default shipping address for orders placed by this organizational entity.' }),

  /**
   * The billing address for this organizational entity.
   */
  billingAddress: AddressSchema.meta({ description: 'The billing address for this organizational entity. Not user editable.'}),

  /**
   * Other allowed shipping addresses
   */
  alternateShippingAddresses: z.array(AddressSchema).default(() => []).meta({ description: 'Other approved shipping addresses for this organizational entity'}),

  /**
   * Various indicators the merchant can use to indicate what the organizational entity can self-manage.
   */

  /**
   * Can user type in a different shipping address at checkout?
   */
  isCustomAddressesAllowed: z.boolean().default(false).meta({ description: 'Whether the organizational entity allows using custom shipping addresses that are not in the address book. If false, the user must select from the address book when placing an order.' }),

  /**
   * Can admin users manage the address book of the organizational entity, adding and removing shipping addresses as needed?
   */
  isSelfManagementOfShippingAddressesAllowed: z.boolean().default(false).meta({ description: 'Whether the organizational entity allows users to manage their own shipping addresses in an address book. If false, the user must contact support to add or update shipping addresses.' }),



});


export const OrganizationalEntityRegistrationStatusSchema = z.object({
  identifier: OrganizationalEntityRegistrationStatusIdentifierSchema,
  organizationalEntityIdentifier: OrganizationalEntityIdentifierSchema,
  name: z.string(),
  pointOfContact: PointOfContactSchema,
  status: z.enum(['pending', 'denied', 'approved']),
  comment: z.string().optional().meta({ description: 'An optional comment from the admin reviewing the organizational entity registration. This can be used to provide feedback to the user about why their registration was denied or what they need to do to get approved.' }),
});

export type OrganizationalEntity = InferType<typeof OrganizationalEntitySchema>;
export type OrganizationalEntityRegistrationStatus = InferType<typeof OrganizationalEntityRegistrationStatusSchema>;
