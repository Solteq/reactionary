import type {
  CompanyRegistrationRequestSchema} from '@reactionary/core';
import {
  type AnyCompanyRegistrationRequestSchema,
  type CompanyRegistrationFactory,
  type CompanyRegistrationRequest,
  type CompanyRegistrationRequestApprovalStatus,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type { MedusaRawCompany } from '../company/company.factory.js';

export class MedusaCompanyRegistrationFactory<
  TCompanyRegistrationRequestSchema extends
    AnyCompanyRegistrationRequestSchema = typeof CompanyRegistrationRequestSchema,
> implements CompanyRegistrationFactory<TCompanyRegistrationRequestSchema>
{
  public readonly companyRegistrationRequestSchema: TCompanyRegistrationRequestSchema;

  constructor(companyRegistrationRequestSchema: TCompanyRegistrationRequestSchema) {
    this.companyRegistrationRequestSchema = companyRegistrationRequestSchema;
  }

  public parseCompanyRegistrationRequest(
    _context: RequestContext,
    data: MedusaRawCompany,
  ): z.output<TCompanyRegistrationRequestSchema> {
    const result = {
      identifier: { key: data.id },
      companyIdentifier: { taxIdentifier: data.tax_identifier },
      name: data.name,
      pointOfContact: { email: data.email, phone: data.phone ?? undefined },
      status: this.parseStatus(data.status),
    } satisfies CompanyRegistrationRequest;

    return this.companyRegistrationRequestSchema.parse(result);
  }

  protected parseStatus(status: string): CompanyRegistrationRequestApprovalStatus {
    switch (status) {
      case 'active':
        return 'approved';
      case 'pending_approval':
        return 'pending';
      default:
        return 'denied';
    }
  }
}
