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
  private readonly searchApiPath: string;
  constructor(private readonly config: HclConfiguration) {
    // HCL Commerce splits endpoints across multiple roots, e.g.:
    //   /search/resources  — query service (products, categories, urls)
    //   /wcs/resources     — transaction service (cart, user, orders)
    // Each API root has its own config property. This client calls the query service.
    this.baseUrl = config.apiUrl.replace(/\/+$/, '');
    this.searchApiPath = config.searchApiPath.replace(/\/+$/, '');
  }

  async findProducts(
    query: HclFindProductsQuery,
  ): Promise<HclProductQueryResponse> {
    const params = new URLSearchParams();

    params.set('storeId', query.storeId ?? this.config.storeId);

    const catalogId = query.catalogId ?? this.config.catalogId;
    if (catalogId) params.set('catalogId', catalogId);

    const langId = query.langId ?? this.config.langId;
    if (langId) params.set('langId', langId);

    const currency = query.currency ?? this.config.currency;
    if (currency) params.set('currency', currency);

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

    const url = `${this.baseUrl}${this.searchApiPath}/api/v2/products?${params.toString()}`;

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
  async resolveSlug(slug: string): Promise<HclUrlResponse | undefined> {
    const params = new URLSearchParams();
    params.set('storeId', this.config.storeId);
    params.append('identifier', slug);

    const url = `${this.baseUrl}${this.searchApiPath}/api/v2/urls?${params.toString()}`;

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

    const langId = query.langId ?? this.config.langId;
    if (langId) params.set('langId', langId);

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

    const url = `${this.baseUrl}${this.searchApiPath}/api/v2/categories?${params.toString()}`;

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
