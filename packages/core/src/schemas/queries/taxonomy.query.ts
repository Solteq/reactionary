import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';
import { ConceptIdentifierSchema, VocabularyIdentifierSchema } from '../models/identifiers.model.js';
import { BaseQuerySchema } from './base.query.js';

export const TaxonomyQueryGetVocabularySchema = BaseQuerySchema.extend({
  vocabulary: VocabularyIdentifierSchema.meta({ description: 'The vocabulary to fetch, with its concept tree.' }),
});

export const TaxonomyQueryGetConceptsSchema = BaseQuerySchema.extend({
  concepts: z.array(ConceptIdentifierSchema).meta({ description: 'The concepts to fetch.' }),
});

export type TaxonomyQueryGetVocabulary = InferType<typeof TaxonomyQueryGetVocabularySchema>;
export type TaxonomyQueryGetConcepts = InferType<typeof TaxonomyQueryGetConceptsSchema>;
