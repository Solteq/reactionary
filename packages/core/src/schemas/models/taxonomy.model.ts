import * as z from 'zod';
import { BaseModelSchema } from './base.model.js';
import { TermIdentifierSchema, VocabularyIdentifierSchema } from './identifiers.model.js';
import type { InferType } from '../../zod-utils.js';

/**
 * A term of a taxonomy vocabulary, e.g. features/cordless in the vocabulary "features".
 * Terms can form a hierarchy through their parent and children.
 */
export const TermSchema = BaseModelSchema.extend({
  identifier: TermIdentifierSchema.describe('The unique identifier of the term, prefixed by its vocabulary.'),
  vocabulary: z.string().meta({ description: 'The vocabulary the term belongs to, e.g. "features".' }),
  name: z.string().meta({ description: 'The localized name of the term.' }),
  synonyms: z.array(z.string()).optional().meta({ description: 'Localized alternative names of the term, useful for search suggestions.' }),
  parent: TermIdentifierSchema.optional().meta({ description: 'The parent term, if the term is part of a hierarchy.' }),
  get children(): z.ZodOptional<z.ZodArray<typeof TermSchema>> {
    return z.array(TermSchema).optional().meta({ description: 'The child terms. Only set where the term is part of a vocabulary tree.' });
  },
});

/**
 * A vocabulary groups terms, e.g. "features" or "brands".
 * The terms of a vocabulary are its root terms, each carrying their child terms.
 */
export const VocabularySchema = BaseModelSchema.extend({
  identifier: VocabularyIdentifierSchema.describe('The unique identifier of the vocabulary.'),
  name: z.string().meta({ description: 'The name of the vocabulary.' }),
  terms: z.array(TermSchema).meta({ description: 'The root terms of the vocabulary. Terms further down are found through the children of a term.' }),
});

export type Term = InferType<typeof TermSchema>;
export type Vocabulary = InferType<typeof VocabularySchema>;
