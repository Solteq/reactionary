import type { HclConfiguration } from '../schema/configuration.schema.js';
import type {
  HclCategoryQueryResponse,
  HclFindCategoriesQuery,
  HclFindProductsQuery,
  HclProductQueryResponse,
  HclUrlQueryResponse,
  HclUrlResponse,
} from '../schema/hcl.schema.js';

export class HclClient {
  private readonly baseUrl: string;
  constructor(private readonly config: HclConfiguration) {
    const origin = (config.searchApiUrl ?? config.apiUrl).replace(/\/+$/, '');
    const apiPath = '/search/resources/api/v2';
    this.baseUrl = `${origin}${apiPath}`;
  }

  async findProducts(
    query: HclFindProductsQuery,
  ): Promise<HclProductQueryResponse> {
    const params = new URLSearchParams();

    params.set('storeId', query.storeId ?? this.config.storeId);

    const catalogId = query.catalogId ?? this.config.catalogId;
    if (catalogId) params.set('catalogId', catalogId);

    if (query.langId) params.set('langId', query.langId);
    if (query.currency) params.set('currency', query.currency);

    if (query.categoryId) params.set('categoryId', query.categoryId);
    if (query.searchTerm) params.set('searchTerm', query.searchTerm);
    if (query.contractId) params.set('contractId', query.contractId);
    if (query.profileName) params.set('profileName', query.profileName);
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.offset !== undefined) params.set('offset', String(query.offset));
    if (query.checkEntitlement !== undefined) {
      params.set('checkEntitlement', String(query.checkEntitlement));
    }

    // Arrays are serialized as repeated params: partNumber=X&partNumber=Y
    for (const id of query.id ?? []) {
      params.append('id', id);
    }
    for (const partNumber of query.partNumber ?? []) {
      params.append('partNumber', partNumber);
    }
    for (const facet of query.facets ?? []) {
      params.append('facet', facet);
    }

    const url = `${this.baseUrl}/products?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `HCL API error ${response.status} ${response.statusText} for URL: ${url}`,
      );
    }

    return response.json() as Promise<HclProductQueryResponse>;
  }

  /**
   * Resolve a URL slug to an HCL token (product partNumber, category ID, etc.).
   * Calls GET /api/v2/urls?storeId=X&identifier=<slug>
   * Returns undefined when the slug is not found (404).
   */
  async resolveSlug(
    slug: string,
    langId?: string,
  ): Promise<HclUrlResponse | undefined> {
    const params = new URLSearchParams();
    params.set('storeId', this.config.storeId);
    params.append('identifier', slug);
    if (langId) params.set('langId', langId);

    const url = `${this.baseUrl}/urls?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (response.status === 404) return undefined;

    if (!response.ok) {
      throw new Error(
        `HCL URL resolve error ${response.status} ${response.statusText} for URL: ${url}`,
      );
    }

    const data = (await response.json()) as HclUrlQueryResponse;
    return data.contents?.[0];
  }

  /**
   * Query categories from the HCL Commerce Query Service.
   * Calls GET /api/v2/categories with the given query parameters.
   */
  async findCategories(
    query: HclFindCategoriesQuery,
  ): Promise<HclCategoryQueryResponse> {
    const params = new URLSearchParams();

    params.set('storeId', query.storeId ?? this.config.storeId);

    const catalogId = query.catalogId ?? this.config.catalogId;
    if (catalogId) params.set('catalogId', catalogId);

    if (query.langId) params.set('langId', query.langId);

    if (query.parentCategoryId)
      params.set('parentCategoryId', query.parentCategoryId);
    if (query.depthAndLimit) params.set('depthAndLimit', query.depthAndLimit);
    if (query.profileName) params.set('profileName', query.profileName);

    for (const id of query.id ?? []) {
      params.append('id', id);
    }
    for (const identifier of query.identifier ?? []) {
      params.append('identifier', identifier);
    }

    const url = `${this.baseUrl}/categories?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `HCL API error ${response.status} ${response.statusText} for URL: ${url}`,
      );
    }

    return response.json() as Promise<HclCategoryQueryResponse>;
  }
}
