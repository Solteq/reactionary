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

/**
 * The most items one call takes. The helpers are exposed as tools, so their input is bounded.
 */
const MAX_CONCEPTS = 200;
const MAX_RANKING_ITEMS = 1000;
const MAX_EXPANSION = 2000;

export const TaxonomyQueryGetRelatedConceptsSchema = BaseQuerySchema.extend({
  concepts: z.array(ConceptIdentifierSchema).max(MAX_CONCEPTS).meta({ description: 'The concepts to navigate from. At most 200.' }),
  relations: z.array(ConceptRelationSchema).max(3).optional().meta({ description: 'The directions to navigate in. Defaults to broader, narrower and related.' }),
  maxDepth: z.int().min(1).max(16).optional().meta({ description: 'How many levels up or down to follow. Defaults to 1, at most 16. Related concepts are always one hop.' }),
});

export const TaxonomyQueryExpandConceptsSchema = BaseQuerySchema.extend({
  concepts: z.array(ProductConceptSchema).max(MAX_CONCEPTS).meta({ description: 'The concepts to expand, typically Product.concepts, which holds the assigned concepts and all their ancestors. At most 200.' }),
  directConcepts: z.array(ConceptIdentifierSchema).max(MAX_CONCEPTS).optional().meta({ description: 'The concepts that were assigned, when known. Authoritative: exactly these are expanded, also ids that are not in concepts, and the ancestors are reached from them. When left out, the ancestors are recognised by the parent links in concepts. An empty list counts as left out.' }),
  policy: ConceptExpansionPolicySchema.optional().meta({ description: 'Overrides the weights and limits of the expansion for this call.' }),
});

export const TaxonomyQueryExpandAffinitiesSchema = BaseQuerySchema.extend({
  affinities: z.record(z.string(), z.number())
    .refine((affinities) => Object.keys(affinities).length <= MAX_CONCEPTS, { error: 'At most 200 affinities.' })
    .meta({ description: 'Concept id to interest weight, from the personalization profile. Personal data. At most 200.' }),
  policy: ConceptExpansionPolicySchema.optional().meta({ description: 'Overrides the weights and limits of the expansion for this call.' }),
  topN: z.int().min(0).max(100).optional().meta({ description: 'How many of the highest affinities are used. Defaults to 20, at most 100.' }),
});

export const TaxonomyQueryRankByConceptsSchema = BaseQuerySchema.extend({
  items: z.array(ConceptRankingItemSchema).max(MAX_RANKING_ITEMS).meta({ description: 'The items to rank, by key, with the ids of their concepts. At most 1000.' }),
  context: z.array(ExpandedConceptSchema).max(MAX_EXPANSION).optional().meta({ description: 'The expanded concepts of what the visitor is looking at, from expandConcepts, which returns at most 2000. At most 2000.' }),
  affinity: z.array(ExpandedConceptSchema).max(MAX_EXPANSION).optional().meta({ description: 'The expanded concepts of the visitor interests, from expandAffinities, which returns at most 2000. At most 2000.' }),
  personalization: ConceptPersonalizationSchema.optional().meta({ description: 'How strongly the affinity influences the ranking.' }),
});

export type TaxonomyQueryGetVocabulary = InferType<typeof TaxonomyQueryGetVocabularySchema>;
export type TaxonomyQueryGetConcepts = InferType<typeof TaxonomyQueryGetConceptsSchema>;

export type TaxonomyQueryGetRelatedConcepts = InferType<typeof TaxonomyQueryGetRelatedConceptsSchema>;
export type TaxonomyQueryExpandConcepts = InferType<typeof TaxonomyQueryExpandConceptsSchema>;
export type TaxonomyQueryExpandAffinities = InferType<typeof TaxonomyQueryExpandAffinitiesSchema>;
export type TaxonomyQueryRankByConcepts = InferType<typeof TaxonomyQueryRankByConceptsSchema>;
