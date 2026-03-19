import type { InferType } from '../../index.js';
import { CompanyIdentifierSchema, CompanySearchIdentifierSchema } from '../models/identifiers.model.js';
import { BaseQuerySchema } from "./base.query.js";

export const CompanyQueryByIdSchema = BaseQuerySchema.extend({
    identifier: CompanyIdentifierSchema
});

export const CompanyQueryListSchema = BaseQuerySchema.extend({
    search:  CompanySearchIdentifierSchema
});

export type CompanyQueryById = InferType<typeof CompanyQueryByIdSchema>;
export type CompanyQueryList = InferType<typeof CompanyQueryListSchema>;
