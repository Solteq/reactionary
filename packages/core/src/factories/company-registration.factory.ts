import type * as z from 'zod';
import type { CompanyRegistrationRequestSchema } from '../schemas/models/company-registration.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyCompanyRegistrationRequestSchema = z.ZodType<
  z.output<typeof CompanyRegistrationRequestSchema>
>;

export interface CompanyRegistrationFactory<
  TCompanyRegistrationRequestSchema extends
    AnyCompanyRegistrationRequestSchema = AnyCompanyRegistrationRequestSchema,
> {
  companyRegistrationRequestSchema: TCompanyRegistrationRequestSchema;
  parseCompanyRegistrationRequest(
    context: RequestContext,
    data: unknown,
  ): z.output<TCompanyRegistrationRequestSchema>;
}

export type CompanyRegistrationFactoryOutput<
  TFactory extends CompanyRegistrationFactory,
> = ReturnType<TFactory['parseCompanyRegistrationRequest']>;

export type CompanyRegistrationFactoryWithOutput<
  TFactory extends CompanyRegistrationFactory,
> = Omit<TFactory, 'parseCompanyRegistrationRequest'> & {
  parseCompanyRegistrationRequest(
    context: RequestContext,
    data: unknown,
  ): CompanyRegistrationFactoryOutput<TFactory>;
};
