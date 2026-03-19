import type * as z from 'zod';
import type {
  CompanyPaginatedListSchema,
  CompanySchema,
} from '../schemas/models/company.model.js';
import type { CompanyQueryList } from '../schemas/queries/company.query.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyCompanySchema = z.ZodType<z.output<typeof CompanySchema>>;
export type AnyCompanyPaginatedListSchema = z.ZodType<
  z.output<typeof CompanyPaginatedListSchema>
>;

export interface CompanyFactory<
  TCompanySchema extends AnyCompanySchema = AnyCompanySchema,
  TCompanyPaginatedListSchema extends AnyCompanyPaginatedListSchema = AnyCompanyPaginatedListSchema,
> {
  companySchema: TCompanySchema;
  companyPaginatedListSchema: TCompanyPaginatedListSchema;
  parseCompany(context: RequestContext, data: unknown): z.output<TCompanySchema>;
  parseCompanyPaginatedList(
    context: RequestContext,
    data: unknown,
    query: CompanyQueryList,
  ): z.output<TCompanyPaginatedListSchema>;
}

export type CompanyFactoryOutput<TFactory extends CompanyFactory> = ReturnType<
  TFactory['parseCompany']
>;

export type CompanyPaginatedListFactoryOutput<TFactory extends CompanyFactory> =
  ReturnType<TFactory['parseCompanyPaginatedList']>;

export type CompanyFactoryWithOutput<TFactory extends CompanyFactory> = Omit<
  TFactory,
  'parseCompany' | 'parseCompanyPaginatedList'
> & {
  parseCompany(context: RequestContext, data: unknown): CompanyFactoryOutput<TFactory>;
  parseCompanyPaginatedList(
    context: RequestContext,
    data: unknown,
    query: CompanyQueryList,
  ): CompanyPaginatedListFactoryOutput<TFactory>;
};
