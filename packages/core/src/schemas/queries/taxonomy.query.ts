import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';
import { ConceptIdentifierSchema, VocabularyIdentifierSchema } from '../models/identifiers.model.js';
import { ConceptExpansionPolicySchema, ConceptPersonalizationSchema, ConceptRankingItemSchema, ConceptRelationSchema, ExpandedConceptSchema } from '../models/taxonomy.model.js';
import { ProductConceptSchema } from '../models/product.model.js';
import { BaseQuerySchema } from './base.query.js';

export const TaxonomyQueryGetVocabularySchema = BaseQuerySchema.extend({
  vocabulary: VocabularyIdentifierSchema.meta({ description: 'The vocabulary to fetch, with its concept tree.' }),
});

export const TaxonomyQueryGetConceptsSchema = BaseQuerySchema.extend({
  concepts: z.array(ConceptIdentifierSchema).meta({ description: 'The concepts to fetch.' }),
});

export const TaxonomyQueryGetRelatedConceptsSchema = BaseQuerySchema.extend({
  concepts: z.array(ConceptIdentifierSchema).meta({ description: 'The concepts to navigate from.' }),
  relations: z.array(ConceptRelationSchema).optional().meta({ description: 'The directions to navigate in. Defaults to broader, narrower and related.' }),
  maxDepth: z.int().min(1).optional().meta({ description: 'How many levels up or down to follow. Defaults to 1. Related concepts are always one hop.' }),
});

export const TaxonomyQueryExpandConceptsSchema = BaseQuerySchema.extend({
  concepts: z.array(ProductConceptSchema).meta({ description: 'The concepts to expand, typically Product.concepts.' }),
  policy: ConceptExpansionPolicySchema.optional().meta({ description: 'Overrides the weights and limits of the expansion for this call.' }),
});

export const TaxonomyQueryExpandAffinitiesSchema = BaseQuerySchema.extend({
  affinities: z.record(z.string(), z.number()).meta({ description: 'Concept id to raw interest score, from the personalization profile. Personal data.' }),
  policy: ConceptExpansionPolicySchema.optional().meta({ description: 'Overrides the weights and limits of the expansion for this call.' }),
  topN: z.int().min(0).optional().meta({ description: 'How many of the highest affinities are used. Defaults to 20.' }),
});

export const TaxonomyQueryRankByConceptsSchema = BaseQuerySchema.extend({
  items: z.array(ConceptRankingItemSchema).meta({ description: 'The items to rank, by key, with the ids of their concepts.' }),
  context: z.array(ExpandedConceptSchema).optional().meta({ description: 'The expanded concepts of what the visitor is looking at, from expandConcepts.' }),
  affinity: z.array(ExpandedConceptSchema).optional().meta({ description: 'The expanded concepts of the visitor interests, from expandAffinities.' }),
  personalization: ConceptPersonalizationSchema.optional().meta({ description: 'How strongly the affinity influences the ranking.' }),
});

export type TaxonomyQueryGetVocabulary = InferType<typeof TaxonomyQueryGetVocabularySchema>;
export type TaxonomyQueryGetConcepts = InferType<typeof TaxonomyQueryGetConceptsSchema>;

export type TaxonomyQueryGetRelatedConcepts = InferType<typeof TaxonomyQueryGetRelatedConceptsSchema>;
export type TaxonomyQueryExpandConcepts = InferType<typeof TaxonomyQueryExpandConceptsSchema>;
export type TaxonomyQueryExpandAffinities = InferType<typeof TaxonomyQueryExpandAffinitiesSchema>;
export type TaxonomyQueryRankByConcepts = InferType<typeof TaxonomyQueryRankByConceptsSchema>;
