import type { HclConfiguration } from '../schema/configuration.schema.js';
import type {
  HclFindProductsQuery,
  HclProductQueryResponse,
  HclUrlQueryResponse,
  HclUrlResponse,
} from '../schema/hcl.schema.js';

export class HclClient {
  constructor(private readonly config: HclConfiguration) {}

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

    const url = `${this.config.apiUrl}/api/v2/products?${params.toString()}`;

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
   */
  async resolveSlug(slug: string): Promise<HclUrlResponse | undefined> {
    const params = new URLSearchParams();
    params.set('storeId', this.config.storeId);
    params.append('identifier', slug);

    const url = `${this.config.apiUrl}/api/v2/urls?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `HCL URL resolve error ${response.status} ${response.statusText} for URL: ${url}`,
      );
    }

    const data = (await response.json()) as HclUrlQueryResponse;
    return data.contents?.[0];
  }
}
