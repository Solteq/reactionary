import type { StoreProductTag } from '@medusajs/types';
import type {
  AnyTermSchema,
  AnyVocabularySchema,
  RequestContext,
  Term,
  TermSchema,
  TaxonomyFactory,
  VocabularySchema,
} from '@reactionary/core';
import { getVocabularyName } from '@reactionary/core';
import type * as z from 'zod';
import { parseTagAsTerm, parseTagSynonyms } from '../../utils/taxonomy.js';

export class MedusaTaxonomyFactory<
  TTermSchema extends AnyTermSchema = typeof TermSchema,
  TVocabularySchema extends AnyVocabularySchema = typeof VocabularySchema,
> implements TaxonomyFactory<TTermSchema, TVocabularySchema>
{
  public readonly termSchema: TTermSchema;
  public readonly vocabularySchema: TVocabularySchema;

  constructor(termSchema: TTermSchema, vocabularySchema: TVocabularySchema) {
    this.termSchema = termSchema;
    this.vocabularySchema = vocabularySchema;
  }

  /**
   * Maps a product tag to a term. The tag value is the term name, translated by Medusa for the request locale.
   * Tags without a term id are no terms and fail here, the capability only hands over tags that have one.
   */
  public parseTerm(context: RequestContext, data: StoreProductTag): z.output<TTermSchema> {
    const term = parseTagAsTerm(data, context.languageContext.locale);
    if (!term) {
      throw new Error(`Product tag ${data.id} has no term id`);
    }
    const synonyms = parseTagSynonyms(data, context.languageContext.locale);
    return this.termSchema.parse({
      ...term,
      ...(synonyms.length > 0 ? { synonyms } : {}),
    });
  }

  /**
   * Builds the vocabulary from the tags of that vocabulary. The terms of the vocabulary are its root terms,
   * every term carries its children. A term whose parent is not among the tags is a root term.
   */
  public parseVocabulary(
    context: RequestContext,
    vocabulary: string,
    terms: StoreProductTag[],
  ): z.output<TVocabularySchema> {
    const parsed: Term[] = terms.map((tag) => this.parseTerm(context, tag));
    const byId = new Map(parsed.map((term) => [term.identifier.key, term]));

    const roots: Term[] = [];
    for (const term of parsed) {
      const parent = term.parent ? byId.get(term.parent.key) : undefined;
      if (parent && parent !== term) {
        parent.children = [...(parent.children ?? []), term];
      } else {
        roots.push(term);
      }
    }

    return this.vocabularySchema.parse({
      identifier: { key: vocabulary },
      name: getVocabularyName(vocabulary),
      terms: roots,
    });
  }
}
