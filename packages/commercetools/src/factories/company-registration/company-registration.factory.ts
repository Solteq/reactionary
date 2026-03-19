import type { BusinessUnit } from '@commercetools/platform-sdk';
import type {
  CompanyRegistrationFactory,
  CompanyRegistrationRequest,
  CompanyRegistrationRequestApprovalStatus,
  RequestContext
} from '@reactionary/core';
import {
  CompanyRegistrationRequestSchema,
} from '@reactionary/core';

export class CommercetoolsCompanyRegistrationFactory implements CompanyRegistrationFactory {
  public companyRegistrationRequestSchema = CompanyRegistrationRequestSchema;

  public parseCompanyRegistrationRequest(
    _context: RequestContext,
    data: BusinessUnit,
  ): CompanyRegistrationRequest {
    const status = this.mapBusinessUnitStatus(data.status);

    const result = {
      identifier: {
        key: data.id,
      },
      companyIdentifier: {
        taxIdentifier: data.key,
      },
      name: data.name,
      pointOfContact: {
        email: data.contactEmail ?? '',
      },
      status,
    } satisfies CompanyRegistrationRequest;

    return CompanyRegistrationRequestSchema.parse(result);
  }

  public mapBusinessUnitStatus(
    status: string,
  ): CompanyRegistrationRequestApprovalStatus {
    switch (status) {
      case 'Active':
        return 'approved';
      case 'Inactive':
        return 'pending';
      default:
        return 'pending';
    }
  }
}
