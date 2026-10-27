import * as z from 'zod';
import { BaseModelSchema } from './base.model.js';
import { ConceptIdentifierSchema, VocabularyIdentifierSchema } from './identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

/**
 * A concept of a taxonomy vocabulary, e.g. features/cordless in the vocabulary "features".
 * Concepts can form a hierarchy through their parent and children.
 */
export const ConceptSchema = BaseModelSchema.extend({
  identifier: ConceptIdentifierSchema.describe('The unique identifier of the concept, prefixed by its vocabulary.'),
  vocabulary: z.string().meta({ description: 'The vocabulary the concept belongs to, e.g. "features".' }),
  name: z.string().meta({ description: 'The localized name of the concept.' }),
  synonyms: z.array(z.string()).optional().meta({ description: 'Localized alternative names of the concept, useful for search suggestions.' }),
  parent: ConceptIdentifierSchema.optional().meta({ description: 'The parent concept, if the concept is part of a hierarchy.' }),
  notation: z.string().optional().meta({ description: 'A code that identifies the concept within its vocabulary, independent of language (SKOS notation).' }),
  definition: z.string().optional().meta({ description: 'The localized definition of the concept (SKOS definition).' }),
  related: z.array(ConceptIdentifierSchema).optional().meta({ description: 'Concepts that are associatively related to this one (SKOS related), not part of its hierarchy.' }),
  get children(): z.ZodOptional<z.ZodArray<typeof ConceptSchema>> {
    return z.array(ConceptSchema).optional().meta({ description: 'The child concepts. Only set where the concept is part of a vocabulary tree.' });
  },
});

/**
 * A vocabulary groups concepts, e.g. "features" or "brands".
 * The concepts of a vocabulary are its root concepts, each carrying their child concepts.
 */
export const VocabularySchema = BaseModelSchema.extend({
  identifier: VocabularyIdentifierSchema.describe('The unique identifier of the vocabulary.'),
  name: z.string().meta({ description: 'The name of the vocabulary.' }),
  concepts: z.array(ConceptSchema).meta({ description: 'The root concepts of the vocabulary. Concepts further down are found through the children of a concept.' }),
});

/**
 * How a concept is reached from the concept it was expanded from.
 */
export const ConceptRelationSchema = z.enum(['broader', 'narrower', 'related']);

/**
 * A concept reached from another one by following the hierarchy or the related links.
 */
export const RelatedConceptSchema = z.looseObject({
  concept: ConceptIdentifierSchema.describe('The concept that was reached.'),
  relation: ConceptRelationSchema.describe('How the concept relates to the one it was reached from: broader (an ancestor), narrower (a descendant) or related.'),
  depth: z.number().meta({ description: 'The number of hops from the starting concept, 1 for a parent, a child or a related concept.' }),
  via: ConceptIdentifierSchema.describe('The concept the navigation started from.'),
});

/**
 * Weights and limits that control how a set of concepts is expanded to the concepts around it.
 * Every value is optional, the defaults of the TaxonomyCapability apply for what is left out.
 */
export const ConceptExpansionPolicySchema = z.looseObject({
  narrowerWeight: z.number().optional().meta({ description: 'Weight of a direct narrower concept (a child). Default 0.8.' }),
  narrowerDecay: z.number().optional().meta({ description: 'Factor applied per further level down. Default 0.8.' }),
  relatedWeight: z.number().optional().meta({ description: 'Weight of a related concept, one hop only and never transitive. Default 0.5.' }),
  broaderWeight: z.number().optional().meta({ description: 'Weight of a direct broader concept (the parent). Default 0.4.' }),
  broaderDecay: z.number().optional().meta({ description: 'Factor applied per further level up. Default 0.6.' }),
  minWeight: z.number().optional().meta({ description: 'Concepts that would get a lower weight are left out. Default 0.15.' }),
  vocabularies: z.array(z.string()).optional().meta({ description: 'The vocabularies the expansion may reach. Defaults to the vocabularies of the starting concepts.' }),
});

/**
 * A concept with the weight it carries after an expansion.
 */
export const ExpandedConceptSchema = z.looseObject({
  identifier: ConceptIdentifierSchema.describe('The concept.'),
  weight: z.number().meta({ description: 'How strongly the concept counts, 1 for an exact concept at full weight.' }),
  via: z.enum(['exact', 'narrower', 'related', 'broader']).meta({ description: 'How the concept was reached, exact for the starting concepts themselves.' }),
  source: ConceptIdentifierSchema.optional().meta({ description: 'The starting concept the weight came from. Not set for exact concepts.' }),
});

/**
 * How strongly a personal profile influences a ranking.
 */
export const ConceptPersonalizationSchema = z.looseObject({
  mode: z.enum(['context', 'blend', 'profile']).optional().meta({ description: 'context ranks on relevance only, blend (default) lets the profile reorder relevant items, profile ranks on the profile only.' }),
  strength: z.number().optional().meta({ description: 'In blend mode, the most the profile can add to the relevance of an item, as a factor between 0 and 1. Default 0.5.' }),
});

/**
 * The input of a ranking: an item by its own key, with the ids of its concepts.
 */
export const ConceptRankingItemSchema = z.looseObject({
  key: z.string().meta({ description: 'The key of the item, e.g. the id of a CMS article. Returned unchanged.' }),
  concepts: z.array(z.string()).meta({ description: 'The ids of the concepts the item is tagged with.' }),
});

export const ConceptRankedItemSchema = z.looseObject({
  key: z.string().meta({ description: 'The key of the item.' }),
  score: z.number().meta({ description: 'The score the items are sorted by.' }),
  relevance: z.number().meta({ description: 'How well the item matches the context. 0 when no context was given.' }),
  affinity: z.number().meta({ description: 'How well the item matches the profile. 0 when no profile was given.' }),
});

export type Concept = InferType<typeof ConceptSchema>;
export type Vocabulary = InferType<typeof VocabularySchema>;
export type ConceptRelation = InferType<typeof ConceptRelationSchema>;
export type RelatedConcept = InferType<typeof RelatedConceptSchema>;
export type ConceptExpansionPolicy = InferType<typeof ConceptExpansionPolicySchema>;
export type ExpandedConcept = InferType<typeof ExpandedConceptSchema>;
export type ConceptPersonalization = InferType<typeof ConceptPersonalizationSchema>;
export type ConceptRankingItem = InferType<typeof ConceptRankingItemSchema>;
export type ConceptRankedItem = InferType<typeof ConceptRankedItemSchema>;
