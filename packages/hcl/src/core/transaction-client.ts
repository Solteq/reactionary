import type { RequestContext } from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type {
  HclDisplayPriceResponse,
  HclEntitledPriceResponse,
  HclInventoryAvailabilityResponse,
  HclPersonResponse,
  HclWcsIdentityResponse,
} from '../schema/hcl.schema.js';

/** Optional WCS session authentication headers. */
export interface HclWcsAuthHeaders {
  WCToken?: string;
  WCTrustedToken?: string;
  /**
   * Personalization tracking ID returned by guestidentity / loginidentity.
   * Forwarded as the `WCPersonalization` header for personalized responses.
   * Optional — omit for anonymous requests or when not available.
   */
  WCPersonalization?: string;
}

/**
 * Read the WCS session tokens stored by HclIdentityCapability from
 * the request context and return them as auth headers.
 * Returns an empty object (no tokens) for anonymous sessions.
 */
export function getWcsAuthFromContext(
  context: RequestContext,
): HclWcsAuthHeaders {
  return {
    WCToken: context.session['hcl.WCToken'] as string | undefined,
    WCTrustedToken: context.session['hcl.WCTrustedToken'] as string | undefined,
    WCPersonalization: context.session['hcl.personalizationID'] as
      | string
      | undefined,
  };
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

  /**
   * Create an anonymous guest session.
   * Calls POST /wcs/resources/store/{storeId}/guestidentity
   * Returns WCToken/WCTrustedToken/userId that can be stored in the session.
   */
  async createGuestIdentity(): Promise<HclWcsIdentityResponse> {
    const url = `${this.storeBaseUrl}/guestidentity`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...this.buildHeaders(), 'Content-Type': 'application/json' },
      body: '{}',
    });

    if (!response.ok) {
      throw new Error(
        `HCL guestidentity error ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<HclWcsIdentityResponse>;
  }

  /**
   * Login with username/password credentials.
   * Calls POST /wcs/resources/store/{storeId}/loginidentity
   * Returns WCToken/WCTrustedToken/userId.
   */
  async loginIdentity(
    logonId: string,
    logonPassword: string,
  ): Promise<HclWcsIdentityResponse> {
    const url = `${this.storeBaseUrl}/loginidentity`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...this.buildHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ logonId, logonPassword }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `HCL loginidentity error ${response.status} ${response.statusText}: ${body}`,
      );
    }

    return response.json() as Promise<HclWcsIdentityResponse>;
  }

  /**
   * Logout the current session.
   * Calls DELETE /wcs/resources/store/{storeId}/loginidentity/{userId}
   * Best-effort — does not throw on 404 (some demo servers omit this endpoint).
   */
  async deleteLoginIdentity(
    userId: string,
    auth: HclWcsAuthHeaders,
  ): Promise<void> {
    const url = `${this.storeBaseUrl}/loginidentity/${encodeURIComponent(userId)}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.buildHeaders(auth),
    });

    // 404 means the endpoint is not supported on this server; silently ignore.
    if (!response.ok && response.status !== 404) {
      throw new Error(
        `HCL logout error ${response.status} ${response.statusText}`,
      );
    }
  }

  /**
   * Register a new person (customer account).
   * Calls PUT /wcs/resources/store/{storeId}/person/@self
   * Requires an active guest session (auth headers).
   * Returns new WCToken/WCTrustedToken/userId for the registered session.
   */
  async registerPerson(
    logonId: string,
    logonPassword: string,
    auth: HclWcsAuthHeaders,
  ): Promise<HclWcsIdentityResponse> {
    const url = `${this.storeBaseUrl}/person/@self`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...this.buildHeaders(auth),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        logonId,
        logonPassword,
        logonPasswordVerify: logonPassword,
        registerType: 'G',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `HCL register error ${response.status} ${response.statusText}: ${body}`,
      );
    }

    return response.json() as Promise<HclWcsIdentityResponse>;
  }

  /**
   * Fetch the currently authenticated user's person record.
   * Calls GET /wcs/resources/store/{storeId}/person/@self
   */
  async getSelfPerson(auth: HclWcsAuthHeaders): Promise<HclPersonResponse> {
    const url = `${this.storeBaseUrl}/person/@self`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(auth),
    });

    if (!response.ok) {
      throw new Error(
        `HCL person/@self error ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<HclPersonResponse>;
  }

  private buildHeaders(auth?: HclWcsAuthHeaders): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth?.WCToken) headers['WCToken'] = auth.WCToken;
    if (auth?.WCTrustedToken) headers['WCTrustedToken'] = auth.WCTrustedToken;
    if (auth?.WCPersonalization)
      headers['WCPersonalization'] = auth.WCPersonalization;
    return headers;
  }
}
