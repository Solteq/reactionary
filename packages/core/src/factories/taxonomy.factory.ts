import type * as z from 'zod';
import type { TermSchema, VocabularySchema } from '../schemas/models/taxonomy.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyTermSchema = z.ZodType<z.output<typeof TermSchema>>;
export type AnyVocabularySchema = z.ZodType<z.output<typeof VocabularySchema>>;

export interface TaxonomyFactory<
  TTermSchema extends AnyTermSchema = AnyTermSchema,
  TVocabularySchema extends AnyVocabularySchema = AnyVocabularySchema,
> {
  termSchema: TTermSchema;
  vocabularySchema: TVocabularySchema;
  parseTerm(context: RequestContext, data: unknown): z.output<TTermSchema>;
  /**
   * Builds the vocabulary and its term tree from the terms of that vocabulary.
   */
  parseVocabulary(context: RequestContext, vocabulary: string, terms: unknown[]): z.output<TVocabularySchema>;
}

export type TaxonomyFactoryTermOutput<TFactory extends TaxonomyFactory> = ReturnType<
  TFactory['parseTerm']
>;

export type TaxonomyFactoryVocabularyOutput<TFactory extends TaxonomyFactory> = ReturnType<
  TFactory['parseVocabulary']
>;

export type TaxonomyFactoryWithOutput<TFactory extends TaxonomyFactory> = Omit<
  TFactory,
  'parseTerm' | 'parseVocabulary'
> & {
  parseTerm(context: RequestContext, data: unknown): TaxonomyFactoryTermOutput<TFactory>;
  parseVocabulary(context: RequestContext, vocabulary: string, terms: unknown[]): TaxonomyFactoryVocabularyOutput<TFactory>;
};
