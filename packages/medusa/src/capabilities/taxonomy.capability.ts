import type { StoreProductTag } from '@medusajs/types';
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
  error,
  Reactionary,
  success,
  TaxonomyCapability,
  TaxonomyQueryGetConceptsSchema,
  TaxonomyQueryGetVocabularySchema,
  ConceptSchema,
  VocabularySchema,
} from '@reactionary/core';
import createDebug from 'debug';
import * as z from 'zod';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaTaxonomyFactory } from '../factories/taxonomy/taxonomy.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { parseTagAsConcept } from '../utils/taxonomy.js';

const debug = createDebug('reactionary:medusa:taxonomy');

interface MedusaProductTagListResponse {
  product_tags: StoreProductTag[];
  count: number;
  offset: number;
  limit: number;
}

/**
 * Exposes the taxonomy concepts that recalcitrant writes as Medusa product tags. The tag value is the concept
 * name, translated by Medusa for the request locale. The concept id is the external_id of the tag, and the
 * vocabulary, parent and synonyms are in its metadata.
 */
export class MedusaTaxonomyCapability<
  TFactory extends TaxonomyFactory = MedusaTaxonomyFactory,
> extends TaxonomyCapability<
  TaxonomyFactoryVocabularyOutput<TFactory>,
  TaxonomyFactoryConceptOutput<TFactory>
> {
  protected config: MedusaConfiguration;
  protected factory: TaxonomyFactoryWithOutput<TFactory>;

  /**
   * The fields requested for tags. The external id and metadata are not part of the default tag fields.
   */
  protected tagFields = '+external_id,+metadata';

  /**
   * The page size used when listing tags.
   */
  protected tagPageSize = 100;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: TaxonomyFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  protected async listTags(query: Record<string, unknown>): Promise<MedusaProductTagListResponse> {
    const client = await this.medusaApi.getClient();
    return client.client.fetch<MedusaProductTagListResponse>('/store/product-tags', {
      method: 'GET',
      query: { fields: this.tagFields, ...query },
    });
  }

  /**
   * Whether a tag is a concept of the vocabulary: by its metadata, or by the vocabulary prefix of its concept id.
   */
  protected isConceptOfVocabulary(tag: StoreProductTag, vocabulary: string): boolean {
    const concept = parseTagAsConcept(tag, this.context.languageContext.locale);
    return concept?.vocabulary === vocabulary;
  }

  /**
   * Medusa cannot filter tags by metadata, so the tags are paged through and the ones of the vocabulary kept.
   */
  protected async fetchVocabularyTags(vocabulary: string): Promise<StoreProductTag[]> {
    const tags: StoreProductTag[] = [];
    let offset = 0;

    for (;;) {
      const response = await this.listTags({ limit: this.tagPageSize, offset });
      const page = response.product_tags ?? [];
      tags.push(...page.filter((tag) => this.isConceptOfVocabulary(tag, vocabulary)));

      offset += this.tagPageSize;
      if (offset >= response.count || page.length === 0) {
        break;
      }
    }

    return tags;
  }

  @Reactionary({
    inputSchema: TaxonomyQueryGetVocabularySchema,
    outputSchema: VocabularySchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async getVocabulary(
    payload: TaxonomyQueryGetVocabulary,
  ): Promise<Result<TaxonomyFactoryVocabularyOutput<TFactory>, NotFoundError>> {
    const tags = await this.fetchVocabularyTags(payload.vocabulary.key);

    if (debug.enabled) {
      debug(`Found ${tags.length} concepts in vocabulary ${payload.vocabulary.key}`);
    }

    if (tags.length === 0) {
      return error<NotFoundError>({ type: 'NotFound', identifier: payload.vocabulary });
    }

    return success(this.factory.parseVocabulary(this.context, payload.vocabulary.key, tags));
  }

  @Reactionary({
    inputSchema: TaxonomyQueryGetConceptsSchema,
    outputSchema: z.array(ConceptSchema),
  })
  public override async getConcepts(
    payload: TaxonomyQueryGetConcepts,
  ): Promise<Result<Array<TaxonomyFactoryConceptOutput<TFactory>>>> {
    const ids = [...new Set(payload.concepts.map((concept) => concept.key))];
    const tagsById = new Map<string, StoreProductTag>();

    for (let start = 0; start < ids.length; start += this.tagPageSize) {
      const chunk = ids.slice(start, start + this.tagPageSize);
      const response = await this.listTags({ external_id: chunk, limit: chunk.length, offset: 0 });
      for (const tag of response.product_tags ?? []) {
        const concept = parseTagAsConcept(tag, this.context.languageContext.locale);
        if (concept) {
          tagsById.set(concept.identifier.key, tag);
        }
      }
    }

    // keep the order of the request, concepts that do not exist are left out
    const concepts = ids
      .map((id) => tagsById.get(id))
      .filter((tag): tag is StoreProductTag => tag !== undefined)
      .map((tag) => this.factory.parseConcept(this.context, tag));

    return success(concepts);
  }
}
