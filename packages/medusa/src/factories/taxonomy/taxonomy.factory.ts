import type { StoreProductTag } from '@medusajs/types';
import type {
  AnyConceptSchema,
  AnyVocabularySchema,
  RequestContext,
  Concept,
  ConceptSchema,
  TaxonomyFactory,
  VocabularySchema,
} from '@reactionary/core';
import { getVocabularyName } from '@reactionary/core';
import type * as z from 'zod';
import { parseTagAsConcept, parseTagSynonyms } from '../../utils/taxonomy.js';

export class MedusaTaxonomyFactory<
  TConceptSchema extends AnyConceptSchema = typeof ConceptSchema,
  TVocabularySchema extends AnyVocabularySchema = typeof VocabularySchema,
> implements TaxonomyFactory<TConceptSchema, TVocabularySchema>
{
  public readonly conceptSchema: TConceptSchema;
  public readonly vocabularySchema: TVocabularySchema;

  constructor(conceptSchema: TConceptSchema, vocabularySchema: TVocabularySchema) {
    this.conceptSchema = conceptSchema;
    this.vocabularySchema = vocabularySchema;
  }

  /**
   * Maps a product tag to a concept. The tag value is the concept name, translated by Medusa for the request locale.
   * Tags without a concept id are no concepts and fail here, the capability only hands over tags that have one.
   */
  public parseConcept(context: RequestContext, data: StoreProductTag): z.output<TConceptSchema> {
    const concept = parseTagAsConcept(data, context.languageContext.locale);
    if (!concept) {
      throw new Error(`Product tag ${data.id} has no concept id`);
    }
    const synonyms = parseTagSynonyms(data, context.languageContext.locale);
    return this.conceptSchema.parse({
      ...concept,
      ...(synonyms.length > 0 ? { synonyms } : {}),
    });
  }

  /**
   * Builds the vocabulary from the tags of that vocabulary. The concepts of the vocabulary are its root concepts,
   * every concept carries its children. A concept whose parent is not among the tags is a root concept.
   */
  public parseVocabulary(
    context: RequestContext,
    vocabulary: string,
    concepts: StoreProductTag[],
  ): z.output<TVocabularySchema> {
    const parsed: Concept[] = concepts.map((tag) => this.parseConcept(context, tag));
    const byId = new Map(parsed.map((concept) => [concept.identifier.key, concept]));

    const roots: Concept[] = [];
    // the parent each concept is attached under, used to refuse an attachment that would close a loop
    const attachedTo = new Map<Concept, Concept>();
    for (const concept of parsed) {
      const parent = concept.parent ? byId.get(concept.parent.key) : undefined;
      if (parent && !this.isAncestorOrSelf(concept, parent, attachedTo)) {
        parent.children = [...(parent.children ?? []), concept];
        attachedTo.set(concept, parent);
      } else {
        // no parent, an unknown parent, or a parent chain that loops back: the concept is a root
        roots.push(concept);
      }
    }

    return this.vocabularySchema.parse({
      identifier: { key: vocabulary },
      name: getVocabularyName(vocabulary),
      concepts: roots,
    });
  }

  /**
   * Whether the candidate is the concept itself or one of its attached ancestors, in which case the concept cannot
   * become a child of the candidate without creating a cycle.
   */
  protected isAncestorOrSelf(concept: Concept, candidate: Concept, attachedTo: Map<Concept, Concept>): boolean {
    let current: Concept | undefined = candidate;
    while (current) {
      if (current === concept) {
        return true;
      }
      current = attachedTo.get(current);
    }
    return false;
  }
}
