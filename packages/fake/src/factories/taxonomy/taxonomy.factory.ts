import type {
  AnyConceptSchema,
  AnyVocabularySchema,
  ConceptSchema,
  RequestContext,
  TaxonomyFactory,
  VocabularySchema,
} from '@reactionary/core';
import { getVocabularyName } from '@reactionary/core';
import type * as z from 'zod';
import { FAKE_VOCABULARY_NAMES, type FakeConceptRecord } from '../../utilities/taxonomy-data.js';

/**
 * The best entry of a map of localized values: the language of the request, then en, then any.
 */
function localized<T>(values: Record<string, T> | undefined, context: RequestContext): T | undefined {
  if (!values) {
    return undefined;
  }
  const language = context.languageContext.locale.split('-')[0];
  return values[language] ?? values['en'] ?? Object.values(values)[0];
}

export class FakeTaxonomyFactory<
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

  public parseConcept(context: RequestContext, data: FakeConceptRecord): z.output<TConceptSchema> {
    const id = `${data.vocabulary}/${data.slug}`;
    const synonyms = localized(data.synonyms, context);
    const definition = localized(data.definition, context);
    return this.conceptSchema.parse({
      identifier: { key: id },
      vocabulary: data.vocabulary,
      name: localized(data.names, context) ?? data.slug,
      ...(synonyms ? { synonyms } : {}),
      ...(data.notation ? { notation: data.notation } : {}),
      ...(definition ? { definition } : {}),
      ...(data.related ? { related: data.related.map((key) => ({ key })) } : {}),
    });
  }

  /**
   * The vocabulary is flat: every concept of it is a root concept.
   */
  public parseVocabulary(context: RequestContext, vocabulary: string, concepts: FakeConceptRecord[]): z.output<TVocabularySchema> {
    return this.vocabularySchema.parse({
      identifier: { key: vocabulary },
      name: localized(FAKE_VOCABULARY_NAMES[vocabulary], context) ?? getVocabularyName(vocabulary),
      concepts: concepts.map((concept) => this.parseConcept(context, concept)),
    });
  }
}
