import type {
  Cache,
  NotFoundError,
  RequestContext,
  Result,
  TaxonomyFactory,
  TaxonomyFactoryConceptOutput,
  TaxonomyFactoryVocabularyOutput,
  TaxonomyFactoryWithOutput,
  TaxonomyQueryGetConcepts,
  TaxonomyQueryGetVocabulary,
} from '@reactionary/core';
import {
  ConceptSchema,
  error,
  Reactionary,
  success,
  TaxonomyCapability,
  TaxonomyQueryGetConceptsSchema,
  TaxonomyQueryGetVocabularySchema,
  VocabularySchema,
} from '@reactionary/core';
import * as z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import type { FakeTaxonomyFactory } from '../factories/taxonomy/taxonomy.factory.js';
import { FAKE_CONCEPTS } from '../utilities/taxonomy-data.js';

/**
 * A small fixed taxonomy for development: the vocabularies features and campaigns with four concepts each.
 */
export class FakeTaxonomyCapability<
  TFactory extends TaxonomyFactory = FakeTaxonomyFactory,
> extends TaxonomyCapability<
  TaxonomyFactoryVocabularyOutput<TFactory>,
  TaxonomyFactoryConceptOutput<TFactory>
> {
  protected config: FakeConfiguration;
  protected factory: TaxonomyFactoryWithOutput<TFactory>;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: TaxonomyFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: TaxonomyQueryGetVocabularySchema,
    outputSchema: VocabularySchema,
  })
  public override async getVocabulary(
    payload: TaxonomyQueryGetVocabulary,
  ): Promise<Result<TaxonomyFactoryVocabularyOutput<TFactory>, NotFoundError>> {
    const concepts = FAKE_CONCEPTS.filter((concept) => concept.vocabulary === payload.vocabulary.key);
    if (concepts.length === 0) {
      return error<NotFoundError>({ type: 'NotFound', identifier: payload.vocabulary });
    }
    return success(this.factory.parseVocabulary(this.context, payload.vocabulary.key, concepts));
  }

  @Reactionary({
    inputSchema: TaxonomyQueryGetConceptsSchema,
    outputSchema: z.array(ConceptSchema),
  })
  public override async getConcepts(
    payload: TaxonomyQueryGetConcepts,
  ): Promise<Result<Array<TaxonomyFactoryConceptOutput<TFactory>>>> {
    const found = [...new Set(payload.concepts.map((concept) => concept.key))]
      .map((id) => FAKE_CONCEPTS.find((concept) => `${concept.vocabulary}/${concept.slug}` === id))
      .filter((concept): concept is NonNullable<typeof concept> => concept !== undefined);
    return success(found.map((concept) => this.factory.parseConcept(this.context, concept)));
  }
}
