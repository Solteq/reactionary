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

export type Concept = InferType<typeof ConceptSchema>;
export type Vocabulary = InferType<typeof VocabularySchema>;
