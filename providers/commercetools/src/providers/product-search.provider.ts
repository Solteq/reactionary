import type {
  ProductSearchFacetResult as CTProductSearchFacetResult,
  ProductSearchFacetResultBucket as CTProductSearchFacetResultBucket,
  ProductVariant as CTProductVariant,
  ProductPagedSearchResponse,
  ProductProjection,
  ProductSearchFacetExpression,
} from '@commercetools/platform-sdk';
import type {
  Cache,
  FacetIdentifier,
  FacetValueIdentifier,
  Meta,
  ProductOptionIdentifier,
  ProductSearchQueryByTerm,
  ProductSearchResult,
  ProductSearchResultFacet,
  ProductSearchResultFacetValue,
  ProductSearchResultItem,
  ProductSearchResultItemVariant,
  ProductVariantIdentifier,
  ProductVariantOption,
  RequestContext,
  SearchIdentifier,
} from '@reactionary/core';
import {
  FacetIdentifierSchema,
  FacetValueIdentifierSchema,
  ImageSchema,
  ProductOptionIdentifierSchema,
  ProductSearchProvider,
  ProductSearchQueryByTermSchema,
  ProductSearchResultFacetSchema,
  ProductSearchResultFacetValueSchema,
  ProductSearchResultItemVariantSchema,
  ProductSearchResultSchema,
  ProductVariantIdentifierSchema,
  ProductVariantOptionSchema,
  Reactionary,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';

import createDebug from 'debug';
import type { CommercetoolsClient } from '../core/client.js';

const debug = createDebug('reactionary:commercetools:search');

export class CommercetoolsSearchProvider extends ProductSearchProvider {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(cache, context);

    this.config = config;
    this.client = client;
  }

  protected async getClient() {
    const client = await this.client.getClient();
    return client
      .withProjectKey({ projectKey: this.config.projectKey })
      .products();
  }

  protected async getFacetQuery(
    payload: ProductSearchQueryByTerm,
    selectedFacetValue: FacetValueIdentifier
  ) {
    return {
      exact: {
        field: selectedFacetValue.facet.key,
        fieldType: 'text',
        value: selectedFacetValue.key,
      },
    };
  }

  protected async getSearchTermExpression(payload: ProductSearchQueryByTerm) {
    return {
      or: [
        {
          fullText: {
            field: 'name',
            language: `${this.context.languageContext.locale}`,
            value: payload.search.term,
          },
        },
        {
          fullText: {
            field: 'description',
            language: `${this.context.languageContext.locale}`,
            value: payload.search.term,
          },
        },
        {
          fullText: {
            field: 'searchKeywords',
            language: `${this.context.languageContext.locale}`,
            value: payload.search.term,
          },
        },
      ],
    };
  }

  protected async getFacetsQuery(payload: ProductSearchQueryByTerm) {
    if (payload.search.facets.length === 0) {
      return undefined;
    }

    const facetsToApply = await Promise.all(
      payload.search.facets.map((facet) => this.getFacetQuery(payload, facet))
    );

    if (facetsToApply.length === 0) {
      return undefined;
    }
    if (facetsToApply.length === 1) {
      return facetsToApply[0];
    }
    return {
      and: facetsToApply,
    };
  }

  protected async getFacetsToReturn(
    payload: ProductSearchQueryByTerm
  ): Promise<ProductSearchFacetExpression[]> {
    const facetsToReturn: ProductSearchFacetExpression[] = [];

    const configFacets = this.config.facetFieldsForSearch || ['category.id'];

    // the default behavior is to get a static list of facets from the config. In more advanced implementations, this could be dynamic based on the payload, ie based on category maybe
    for (const facet of configFacets) {
      facetsToReturn.push({
        distinct: {
          name: facet,
          field: facet,
          fieldType: 'text',
          limit: 50,
        },
      });
    }

    return facetsToReturn;
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm
  ): Promise<ProductSearchResult> {
    const client = await this.getClient();

    const facetsToReturn = await this.getFacetsToReturn(payload);
    const facetsToApply = await this.getFacetsQuery(payload);
    const searchTermExpression = await this.getSearchTermExpression(payload);
    let finalFilterExpression: any = undefined;

    if (facetsToApply) {
      finalFilterExpression = {
        and: [searchTermExpression, facetsToApply],
      };
    } else {
      finalFilterExpression = searchTermExpression;
    }

    const response = await client
      .search()
      .post({
        body: {
          query: finalFilterExpression,
          productProjectionParameters: {
            storeProjection: this.context.storeIdentifier.key,
          },
          limit: payload.search.paginationOptions.pageSize,
          offset:
            (payload.search.paginationOptions.pageNumber - 1) *
            payload.search.paginationOptions.pageSize,

          facets: [...facetsToReturn],
        },
      })
      .execute();

    const responseBody = response.body;
    const result = this.parsePaginatedResult(
      responseBody,
      payload
    ) as ProductSearchResult;

    if (debug.enabled) {
      debug(
        `Search for term "${payload.search.term}" returned ${responseBody.results.length} products (page ${payload.search.paginationOptions.pageNumber} of ${result.totalPages})`
      );
    }

    return result;
  }

  protected parseSingle(body: ProductProjection) {
    const identifier = { key: body.id };
    const name = body.name[this.context.languageContext.locale] || body.id;
    const slug = body.slug?.[this.context.languageContext.locale] || body.id;
    const variants = [body.masterVariant, ...body.variants].map((variant) =>
      this.parseVariant(variant, body)
    );
    const meta = {
      cache: {
        hit: false,
        key: '',
      },
      placeholder: false,
    } satisfies Meta;

    const product = {
      identifier,
      name,
      slug,
      variants,
      meta,
    } satisfies ProductSearchResultItem;

    return product;
  }

  protected parsePaginatedResult(
    body: ProductPagedSearchResponse,
    query: ProductSearchQueryByTerm
  ) {
    const identifier = {
      ...query.search,
    } satisfies SearchIdentifier;

    const products: ProductSearchResultItem[] = body.results.map((p) =>
      this.parseSingle(p.productProjection!)
    );
    const facets: ProductSearchResultFacet[] = [];

    for (const facet of body.facets) {
      const facetIdentifier = FacetIdentifierSchema.parse({
        key: facet.name,
      } satisfies Partial<FacetIdentifier>);

      facets.push(this.parseFacet(facetIdentifier, facet));
    }

    const result = {
      identifier,
      meta: {
        cache: { hit: false, key: 'unknown' },
        placeholder: false,
      },
      pageNumber: (Math.ceil(body.offset / body.limit) || 0) + 1,
      pageSize: body.limit,
      totalCount: body.total || 0,
      totalPages: Math.ceil((body.total || 0) / body.limit || 0) + 1,
      items: products,
      facets,
    } satisfies ProductSearchResult;

    return result;
  }

  /**
   * See version 0.0.81 for ProductProjection based facet parsing
   * @param facetIdentifier
   * @param facetValue
   * @returns
   */
  protected parseFacet(
    facetIdentifier: FacetIdentifier,
    facet: CTProductSearchFacetResult
  ): ProductSearchResultFacet {
    const result: ProductSearchResultFacet =
      ProductSearchResultFacetSchema.parse({
        identifier: facetIdentifier,
        name: facet.name,
        values: [],
      });

    const distinctFacet = facet as CTProductSearchFacetResultBucket;
    if (distinctFacet) {
      distinctFacet.buckets.forEach((bucket) => {
        const facetValueIdentifier = FacetValueIdentifierSchema.parse({
          facet: facetIdentifier,
          key: bucket.key,
        } satisfies Partial<FacetValueIdentifier>);

        result.values.push(
          this.parseFacetValue(facetValueIdentifier, bucket.key, bucket.count)
        );
      });
    }

    return result;
  }

  protected parseFacetValue(
    facetValueIdentifier: FacetValueIdentifier,
    label: string,
    count: number
  ): ProductSearchResultFacetValue {
    return ProductSearchResultFacetValueSchema.parse({
      identifier: facetValueIdentifier,
      name: label,
      count: count,
      active: false,
    } satisfies Partial<ProductSearchResultFacetValue>);
  }

  protected parseVariant(
    variant: CTProductVariant,
    product: ProductProjection
  ): ProductSearchResultItemVariant {
    const sourceImage = variant.images?.[0];

    const img = ImageSchema.parse({
      sourceUrl: sourceImage?.url || '',
      height: sourceImage?.dimensions.h || undefined,
      width: sourceImage?.dimensions.w || undefined,
      altText:
        sourceImage?.label ||
        product.name[this.context.languageContext.locale] ||
        undefined,
    });

    const mappedOptions =
      variant.attributes
        ?.filter((x) => x.name === 'Color')
        .map((opt) =>
          ProductVariantOptionSchema.parse({
            identifier: ProductOptionIdentifierSchema.parse({
              key: opt.name,
            } satisfies Partial<ProductOptionIdentifier>),
            name: opt.value || '',
          } satisfies Partial<ProductVariantOption>)
        ) || [];

    const mappedOption = mappedOptions?.[0];

    return ProductSearchResultItemVariantSchema.parse({
      variant: ProductVariantIdentifierSchema.parse({
        sku: variant.sku || '',
      } satisfies ProductVariantIdentifier),
      image: img,
      options: mappedOption,
    } satisfies Partial<ProductSearchResultItemVariant>);
  }
}
