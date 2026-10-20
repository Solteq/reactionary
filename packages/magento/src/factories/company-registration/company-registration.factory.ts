import type {
  AnyCompanyRegistrationRequestSchema,
  CompanyRegistrationFactory,
  CompanyRegistrationRequest,
  CompanyRegistrationRequestApprovalStatus,
  CompanyRegistrationRequestSchema,
  RequestContext,
} from '@reactionary/core';
import * as z from 'zod';
import { encodeMagentoUid } from '../../core/company.api.js';
import {
  MagentoAdminCompanySchema,
  MagentoCompanySchema,
} from '../../schema/company.types.js';
import { toMagentoCompanyIdentifier } from '../company/company.factory.js';

/**
 * The registration factory parses either
 * - the company returned by the storefront `createCompany` mutation, which is
 *   always pending approval (Magento holds storefront-registered companies
 *   for a merchant to approve), or
 * - the admin REST `CompanyInterface`, whose numeric status carries the
 *   approval outcome and whose `reject_reason` becomes the comment.
 *
 * `requestKey` is the signed registration request key (see
 * `createRegistrationKey`).
 */
export const MagentoCompanyRegistrationInputSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('storefront'),
    requestKey: z.string(),
    company: MagentoCompanySchema,
  }),
  z.object({
    source: z.literal('admin'),
    requestKey: z.string(),
    company: MagentoAdminCompanySchema,
  }),
]);

export type MagentoCompanyRegistrationInput = z.infer<
  typeof MagentoCompanyRegistrationInputSchema
>;

export class MagentoCompanyRegistrationFactory<
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
    data: unknown,
  ): z.output<TCompanyRegistrationRequestSchema> {
    const input = MagentoCompanyRegistrationInputSchema.parse(data);

    let result: CompanyRegistrationRequest;
    if (input.source === 'storefront') {
      const company = input.company;
      result = {
        identifier: { key: input.requestKey },
        companyIdentifier: toMagentoCompanyIdentifier(company),
        name: company.name || company.legal_name || '',
        pointOfContact: {
          email: company.email ?? '',
          phone: company.legal_address?.telephone ?? undefined,
        },
        status: 'pending',
      };
    } else {
      const company = input.company;
      // The admin API speaks numeric ids; the storefront one, base64 uids.
      const uid = encodeMagentoUid(String(company.id));
      result = {
        identifier: { key: input.requestKey },
        companyIdentifier: toMagentoCompanyIdentifier({
          id: uid,
          vat_tax_id: company.vat_tax_id,
        }),
        name: company.company_name || company.legal_name || '',
        pointOfContact: {
          email: company.company_email ?? '',
          phone: company.telephone ?? undefined,
        },
        status: this.parseStatus(company.status),
        comment: company.reject_reason || undefined,
      };
    }

    return this.companyRegistrationRequestSchema.parse(result);
  }

  /**
   * Magento company status: 0 pending approval, 1 approved, 2 rejected,
   * 3 blocked. A blocked company cannot trade, so it reads as `denied`.
   */
  protected parseStatus(status: number): CompanyRegistrationRequestApprovalStatus {
    switch (status) {
      case 0:
        return 'pending';
      case 1:
        return 'approved';
      default:
        return 'denied';
    }
  }
}
