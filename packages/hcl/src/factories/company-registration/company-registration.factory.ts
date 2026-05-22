import type * as z from 'zod';
import type {
  AnyCompanyRegistrationRequestSchema,
  CompanyRegistrationFactory,
  CompanyRegistrationRequestSchema,
  RequestContext,
} from '@reactionary/core';
import type {
  HclBuyerRegistrationResponse,
  HclOrganizationItem,
} from '../../schema/hcl.schema.js';

/** HCL organization status code → domain approval status mapping. */
function parseApprovalStatus(
  status?: string,
): 'pending' | 'approved' | 'denied' {
  switch (status) {
    case '1':
      return 'approved';
    case '2':
      return 'denied';
    default:
      return 'pending';
  }
}

export class HclCompanyRegistrationFactory<
  TSchema extends
    AnyCompanyRegistrationRequestSchema = typeof CompanyRegistrationRequestSchema,
> implements CompanyRegistrationFactory<TSchema>
{
  public readonly companyRegistrationRequestSchema: TSchema;

  constructor(companyRegistrationRequestSchema: TSchema) {
    this.companyRegistrationRequestSchema = companyRegistrationRequestSchema;
  }

  /**
   * Parses a buyer registration response (POST /organization/buyer) into a
   * CompanyRegistrationRequest. The `data` may be either the POST response
   * (HclBuyerRegistrationResponse) or a full org item (HclOrganizationItem) from
   * a subsequent status check (GET /organization/{id}).
   */
  public parseCompanyRegistrationRequest(
    _context: RequestContext,
    data: HclBuyerRegistrationResponse | HclOrganizationItem,
  ): z.output<TSchema> {
    const orgId =
      'orgEntityId' in data
        ? (data as HclBuyerRegistrationResponse).orgEntityId
        : ((data as HclOrganizationItem).organizationId ??
          (data as HclOrganizationItem).orgEntityId ??
          '');

    const orgItem = data as HclOrganizationItem;

    return this.companyRegistrationRequestSchema.parse({
      identifier: { key: orgId },
      companyIdentifier: {
        taxIdentifier: orgItem.taxPayerId ?? orgId,
      },
      name: orgItem.organizationName ?? orgItem.displayName ?? '',
      pointOfContact: {
        email: orgItem.contactInfo?.email1 ?? '',
        phone: orgItem.contactInfo?.phone1,
      },
      status: parseApprovalStatus(orgItem.status),
      comment: orgItem.description,
    });
  }
}
