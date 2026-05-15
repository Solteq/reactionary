import type { HclConfiguration } from '../schema/configuration.schema.js';
import type {
  HclDisplayPriceResponse,
  HclEntitledPriceResponse,
  HclInventoryAvailabilityResponse,
} from '../schema/hcl.schema.js';

/** Optional WCS session authentication headers. */
export interface HclWcsAuthHeaders {
  WCToken?: string;
  WCTrustedToken?: string;
}

/**
 * HTTP client for the HCL Commerce Transaction Service (WCS).
 * Base URL: {apiUrl}/wcs/resources/store/{storeId}
 *
 * This is intentionally separate from HclClient (Query Service) because WCS
 * uses a different base path, may require session auth headers, and is used
 * for cart / identity / price / inventory — not catalog lookups.
 */
export class HclTransactionClient {
  private readonly storeBaseUrl: string;

  constructor(private readonly config: HclConfiguration) {
    const baseUrl = config.apiUrl.replace(/\/+$/, '');
    this.storeBaseUrl = `${baseUrl}/wcs/resources/store/${config.storeId}`;
  }

  /**
   * Retrieve entitled (contracted/anonymous) prices for one or more part numbers.
   * Calls GET /wcs/resources/store/{storeId}/price?q=byPartNumbers&partNumber=X...
   *
   * This is the primary price endpoint — it works without a configured price rule,
   * returns the default display price for anonymous sessions and the contracted
   * price for authenticated B2B sessions (when WCToken/WCTrustedToken are set).
   */
  async getEntitledPrice(
    partNumbers: string[],
    opts?: { currency?: string },
    auth?: HclWcsAuthHeaders,
  ): Promise<HclEntitledPriceResponse> {
    const params = new URLSearchParams();
    params.set('q', 'byPartNumbers');
    for (const pn of partNumbers) {
      params.append('partNumber', pn);
    }
    if (opts?.currency) params.set('currency', opts.currency);

    const url = `${this.storeBaseUrl}/price?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(auth),
    });

    if (!response.ok) {
      throw new Error(
        `HCL price error ${response.status} ${response.statusText} for URL: ${url}`,
      );
    }

    return response.json() as Promise<HclEntitledPriceResponse>;
  }

  /**
   * Retrieve display/list prices for one or more part numbers using a price rule.
   * Calls GET /wcs/resources/store/{storeId}/display_price
   *   ?q=byPartNumbersAndPriceRuleId
   *   &partNumber=X[&partNumber=Y...]
   *   [&priceRuleId=Z]
   *   [&currency=USD]
   */
  async getDisplayPrice(
    partNumbers: string[],
    opts?: { priceRuleId?: string; currency?: string },
    auth?: HclWcsAuthHeaders,
  ): Promise<HclDisplayPriceResponse> {
    const params = new URLSearchParams();
    params.set('q', 'byPartNumbersAndPriceRuleId');
    for (const pn of partNumbers) {
      params.append('partNumber', pn);
    }
    if (opts?.priceRuleId) params.set('priceRuleId', opts.priceRuleId);
    if (opts?.currency) params.set('currency', opts.currency);

    const url = `${this.storeBaseUrl}/display_price?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(auth),
    });

    if (!response.ok) {
      throw new Error(
        `HCL display_price error ${response.status} ${response.statusText} for URL: ${url}`,
      );
    }

    return response.json() as Promise<HclDisplayPriceResponse>;
  }

  /**
   * Retrieve inventory availability for one or more part numbers.
   * Calls GET /wcs/resources/store/{storeId}/inventoryavailability/byPartNumber/{csv}
   *   [?physicalStoreName=X]
   */
  async getInventoryByPartNumber(
    partNumbers: string[],
    physicalStoreName?: string,
    auth?: HclWcsAuthHeaders,
  ): Promise<HclInventoryAvailabilityResponse> {
    const csv = partNumbers.map(encodeURIComponent).join(',');
    const params = new URLSearchParams();
    if (physicalStoreName) params.set('physicalStoreName', physicalStoreName);

    const query = params.toString() ? `?${params.toString()}` : '';
    const url = `${this.storeBaseUrl}/inventoryavailability/byPartNumber/${csv}${query}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(auth),
    });

    if (!response.ok) {
      throw new Error(
        `HCL inventoryavailability error ${response.status} ${response.statusText} for URL: ${url}`,
      );
    }

    return response.json() as Promise<HclInventoryAvailabilityResponse>;
  }

  private buildHeaders(auth?: HclWcsAuthHeaders): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth?.WCToken) headers['WCToken'] = auth.WCToken;
    if (auth?.WCTrustedToken) headers['WCTrustedToken'] = auth.WCTrustedToken;
    return headers;
  }
}
