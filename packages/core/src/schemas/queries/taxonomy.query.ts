import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';
import { TermIdentifierSchema, VocabularyIdentifierSchema } from '../models/identifiers.model.js';
import { BaseQuerySchema } from './base.query.js';

export const TaxonomyQueryGetVocabularySchema = BaseQuerySchema.extend({
  vocabulary: VocabularyIdentifierSchema.meta({ description: 'The vocabulary to fetch, with its term tree.' }),
});

export const TaxonomyQueryGetTermsSchema = BaseQuerySchema.extend({
  terms: z.array(TermIdentifierSchema).meta({ description: 'The terms to fetch.' }),
});

export type TaxonomyQueryGetVocabulary = InferType<typeof TaxonomyQueryGetVocabularySchema>;
export type TaxonomyQueryGetTerms = InferType<typeof TaxonomyQueryGetTermsSchema>;
