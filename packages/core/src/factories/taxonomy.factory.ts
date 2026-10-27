import type * as z from 'zod';
import type { ConceptSchema, VocabularySchema } from '../schemas/models/taxonomy.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyConceptSchema = z.ZodType<z.output<typeof ConceptSchema>>;
export type AnyVocabularySchema = z.ZodType<z.output<typeof VocabularySchema>>;

export interface TaxonomyFactory<
  TConceptSchema extends AnyConceptSchema = AnyConceptSchema,
  TVocabularySchema extends AnyVocabularySchema = AnyVocabularySchema,
> {
  conceptSchema: TConceptSchema;
  vocabularySchema: TVocabularySchema;
  parseConcept(context: RequestContext, data: unknown): z.output<TConceptSchema>;
  /**
   * Builds the vocabulary and its concept tree from the concepts of that vocabulary.
   */
  parseVocabulary(context: RequestContext, vocabulary: string, concepts: unknown[]): z.output<TVocabularySchema>;
}

export type TaxonomyFactoryConceptOutput<TFactory extends TaxonomyFactory> = ReturnType<
  TFactory['parseConcept']
>;

export type TaxonomyFactoryVocabularyOutput<TFactory extends TaxonomyFactory> = ReturnType<
  TFactory['parseVocabulary']
>;

export type TaxonomyFactoryWithOutput<TFactory extends TaxonomyFactory> = Omit<
  TFactory,
  'parseConcept' | 'parseVocabulary'
> & {
  parseConcept(context: RequestContext, data: unknown): TaxonomyFactoryConceptOutput<TFactory>;
  parseVocabulary(context: RequestContext, vocabulary: string, concepts: unknown[]): TaxonomyFactoryVocabularyOutput<TFactory>;
};
