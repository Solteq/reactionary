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
    // the parent each term is attached under, used to refuse an attachment that would close a loop
    const attachedTo = new Map<Term, Term>();
    for (const term of parsed) {
      const parent = term.parent ? byId.get(term.parent.key) : undefined;
      if (parent && !this.isAncestorOrSelf(term, parent, attachedTo)) {
        parent.children = [...(parent.children ?? []), term];
        attachedTo.set(term, parent);
      } else {
        // no parent, an unknown parent, or a parent chain that loops back: the term is a root
        roots.push(term);
      }
    }

    return this.vocabularySchema.parse({
      identifier: { key: vocabulary },
      name: getVocabularyName(vocabulary),
      terms: roots,
    });
  }

  /**
   * Whether the candidate is the term itself or one of its attached ancestors, in which case the term cannot
   * become a child of the candidate without creating a cycle.
   */
  protected isAncestorOrSelf(term: Term, candidate: Term, attachedTo: Map<Term, Term>): boolean {
    let current: Term | undefined = candidate;
    while (current) {
      if (current === term) {
        return true;
      }
      current = attachedTo.get(current);
    }
    return false;
  }
}
