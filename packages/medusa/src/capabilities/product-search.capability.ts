import type {
  StoreProductCategory
} from '@medusajs/types';
import {
  FacetIdentifierSchema,
  FacetValueIdentifierSchema,
  ProductSearchCapability,
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
  Reactionary,
  DEFAULT_SEARCH_FACET_POLICY,
  error,
  getConceptVocabulary,
  getSearchFilterProblem,
  type InvalidInputError,
  success,
  type Cache,
  type ConceptIdentifier,
  type FacetValueIdentifier,
  type ProductSearchFactory,
  type ProductSearchFactoryOutput,
  type ProductSearchFactoryWithOutput,
  type ProductSearchQueryByTerm,
  type ProductSearchQueryCreateNavigationFilter,
  type RequestContext,
  type Result
} from '@reactionary/core';
import createDebug from 'debug';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { collectTags, getTagsWithDescendants, parseTagAsConcept, type MedusaTagPage } from '../utils/taxonomy.js';

const debug = createDebug('reactionary:medusa:search');

export class MedusaProductSearchCapability<
  TFactory extends ProductSearchFactory = MedusaProductSearchFactory,
> extends ProductSearchCapability<ProductSearchFactoryOutput<TFactory>> {
  protected config: MedusaConfiguration;
  protected factory: ProductSearchFactoryWithOutput<TFactory>;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: ProductSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  protected async resolveCategoryIdByExternalId(
    externalId: string
  ): Promise<StoreProductCategory | null> {
    const sdk = await this.medusaApi.getClient();
    let offset = 0;
    const limit = 50;
    let candidate: StoreProductCategory | undefined = undefined;
    while (true) {
      try {
        const categoryResult = await sdk.store.category.list({
          offset,
          limit,
        });

        if (categoryResult.product_categories.length === 0) {
          break;
        }

        candidate = categoryResult.product_categories.find(
          (cat) => cat.external_id === externalId
        );
        if (candidate) {
          break;
        }
        offset += limit;
      } catch (error) {
        throw new Error(
          'Category not found ' + externalId + ' due to error: ' + error
        );
        break;
      }
    }
    return candidate || null;
  }


  protected queryByTermPayload(payload: ProductSearchQueryByTerm, categoryIdsToFind: string[] | null, tagIdsToFind: string[] | null = null): any {

    const finalSearch = (payload.search.term || '').trim().replace('*', '');

    return {
      q: finalSearch,
      ...(categoryIdsToFind?.length ? { category_id: categoryIdsToFind } : {}),
      ...(tagIdsToFind?.length ? { tag_id: tagIdsToFind } : {}),
      limit: payload.search.paginationOptions.pageSize,
      fields: '+metadata.*,+external_id',
      offset:
        (payload.search.paginationOptions.pageNumber - 1) *
        payload.search.paginationOptions.pageSize,
    };
  }

  public override async createCategoryNavigationFilter(
    payload: ProductSearchQueryCreateNavigationFilter
  ): Promise<Result<FacetValueIdentifier>> {
    const facetIdentifier = FacetIdentifierSchema.parse({
      key: 'categories',
    });
    const facetValueIdentifier = FacetValueIdentifierSchema.parse({
      facet: facetIdentifier,
      key: payload.categoryPath[payload.categoryPath.length - 1].identifier.key,
    });

    return success(facetValueIdentifier);
  }

  protected async getAllChildCategoryIds(id: string) {
    const client = await this.medusaApi.getClient();
    const { product_category } = await client.store.category.retrieve(id, {
      include_descendants_tree: true,
      fields: '*category_children',
    });

    const flatten = (
      category: typeof product_category,
    ): Array<string> => [
      category.id,
      ...(category.category_children ?? []).flatMap(flatten),
    ];

    return flatten(product_category);
  }


  /**
   * The Medusa tag ids that match a concept: its own tag and the tags of all its descendants, so that a page about "lighting" also
   * lists the products tagged "ceiling lamps". Concepts are product tags, the concept id is the external id of the tag. Medusa cannot
   * filter tags by metadata, so the tags of the vocabulary are read, which the 5 minutes cache of the search spares most searches.
   * Empty when the store has no such concept.
   */
  protected async resolveConceptTagIds(concept: ConceptIdentifier): Promise<string[]> {
    const client = await this.medusaApi.getClient();
    const locale = this.context.languageContext.locale;
    const vocabulary = getConceptVocabulary(concept);
    const tags = await collectTags(
      (page) =>
        client.client.fetch<MedusaTagPage>('/store/product-tags', {
          method: 'GET',
          query: { fields: 'id,value,external_id,metadata', ...page },
        }),
      (tag) => parseTagAsConcept(tag, locale)?.vocabulary === vocabulary,
      100,
    );
    return getTagsWithDescendants(tags, concept.key, locale).map((tag) => tag.id);
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm
  ): Promise<Result<ProductSearchFactoryOutput<TFactory>>> {
    const filterProblem = getSearchFilterProblem(payload.search, ['conceptContext'], DEFAULT_SEARCH_FACET_POLICY);
    if (filterProblem !== undefined) {
      return error<InvalidInputError>({ type: 'InvalidInput', error: filterProblem });
    }

    const conceptContext = payload.search.conceptContext ?? [];
    if (conceptContext.length > 1) {
      // tag_id matches any of the tags, so two concepts that must both match cannot be asked in one request
      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: 'This product search provider matches one conceptContext concept, as Medusa filters by tag with any of them matching. Search with one concept.',
      });
    }

    const client = await this.medusaApi.getClient();

    let tagIdsToFind: string[] | null = null;
    if (conceptContext.length === 1) {
      tagIdsToFind = await this.resolveConceptTagIds(conceptContext[0]);
      if (tagIdsToFind.length === 0) {
        // an unknown concept matches nothing. Leaving the filter out would list every product on a page about nothing
        const { pageNumber, pageSize } = payload.search.paginationOptions;
        return success(
          this.factory.parseSearchResult(
            this.context,
            { products: [], count: 0, offset: (pageNumber - 1) * pageSize, limit: pageSize },
            payload,
          ),
        );
      }
    }

    let categoryIdsToFind: string[] | null = null;
    if (payload.search.categoryFilter?.key) {
      debug(
        `Resolving category filter for key: ${payload.search.categoryFilter.key}`
      );

      const category = await this.resolveCategoryIdByExternalId(
        payload.search.categoryFilter.key
      );

      if (category) {
        categoryIdsToFind = await this.getAllChildCategoryIds(
          category.id,
        );

        debug(
          `Resolved category filter key ${payload.search.categoryFilter.key} to id: ${categoryIdsToFind}`,
        );
      } else {
        debug(
          `Could not resolve category filter for key: ${payload.search.categoryFilter.key}`
        );
      }
    }


    const response = await client.store.product.list(
      this.queryByTermPayload(payload, categoryIdsToFind, tagIdsToFind),
    );

    const result = this.factory.parseSearchResult(this.context, response, payload);
    if (debug.enabled) {
      debug(
        `Search for term "${payload.search.term}" returned ${response.products.length} products (page ${payload.search.paginationOptions.pageNumber} of ${result.totalPages})`
      );
    }

    return success(result);
  }

}
