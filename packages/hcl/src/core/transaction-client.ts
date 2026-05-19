import type { RequestContext } from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type {
  HclDisplayPriceResponse,
  HclEntitledPriceResponse,
  HclInventoryAvailabilityResponse,
  HclPersonResponse,
  HclWcsAddress,
  HclWcsCartResponse,
  HclWcsIdentityResponse,
  HclWcsOrderIdContainer,
  HclWcsOrderItemUpdateResponse,
  HclWcsPaymentMethodsResponse,
  HclWcsShipModesResponse,
} from '../schema/hcl.schema.js';

/** Thrown by getCart when the WCS server returns 404 (no active cart). */
export class HclCartNotFoundError extends Error {
  constructor() {
    super('No active cart found');
    this.name = 'HclCartNotFoundError';
  }
}

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
   * Fetch the current user's person record.
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

  // -------------------------------------------------------------------------
  // Cart / Checkout
  // -------------------------------------------------------------------------

  /**
   * Fetch the current user's active cart.
   * GET /wcs/resources/store/{storeId}/cart/@self
   * Throws HclCartNotFoundError on 404 (no active cart).
   */
  async getCart(
    opts?: { currency?: string; langId?: string },
    auth?: HclWcsAuthHeaders,
  ): Promise<HclWcsCartResponse> {
    const params = new URLSearchParams();
    if (opts?.currency) params.set('currency', opts.currency);
    if (opts?.langId) params.set('langId', opts.langId);
    const query = params.toString() ? `?${params.toString()}` : '';
    const url = `${this.storeBaseUrl}/cart/@self${query}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(auth),
    });

    if (response.status === 404) {
      throw new HclCartNotFoundError();
    }
    if (!response.ok) {
      throw new Error(
        `HCL cart/@self error ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<HclWcsCartResponse>;
  }

  /**
   * Add a SKU to the cart (creates the cart if it does not yet exist).
   * POST /wcs/resources/store/{storeId}/cart
   * x_calculateOrder=1 triggers server-side price recalculation.
   */
  async addOrderItem(
    partNumber: string,
    quantity: number,
    auth?: HclWcsAuthHeaders,
  ): Promise<HclWcsOrderItemUpdateResponse> {
    const url = `${this.storeBaseUrl}/cart`;
    const body = {
      orderItem: [{ partNumber, quantity: String(quantity) }],
      x_calculateOrder: '1',
      x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.buildHeaders(auth),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HCL addOrderItem error ${response.status}: ${text}`);
    }

    return response.json() as Promise<HclWcsOrderItemUpdateResponse>;
  }

  /**
   * Update the quantity of an existing cart item.
   * PUT /wcs/resources/store/{storeId}/cart/@self/update_order_item
   */
  async updateOrderItem(
    orderItemId: string,
    quantity: number,
    auth?: HclWcsAuthHeaders,
  ): Promise<HclWcsOrderItemUpdateResponse> {
    const url = `${this.storeBaseUrl}/cart/@self/update_order_item`;
    const body = {
      orderItem: [{ orderItemId, quantity: String(quantity) }],
      x_calculateOrder: '1',
      x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...this.buildHeaders(auth),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HCL updateOrderItem error ${response.status}: ${text}`);
    }

    return response.json() as Promise<HclWcsOrderItemUpdateResponse>;
  }

  /**
   * Remove a single item from the cart.
   * PUT /wcs/resources/store/{storeId}/cart/@self/delete_order_item
   */
  async deleteOrderItem(
    orderItemId: string,
    auth?: HclWcsAuthHeaders,
  ): Promise<void> {
    const url = `${this.storeBaseUrl}/cart/@self/delete_order_item`;
    const body = {
      orderItemId,
      x_calculateOrder: '1',
      x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...this.buildHeaders(auth),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HCL deleteOrderItem error ${response.status}: ${text}`);
    }
  }

  /**
   * Delete (cancel) the entire active cart.
   * DELETE /wcs/resources/store/{storeId}/cart/@self
   */
  async deleteCart(auth?: HclWcsAuthHeaders): Promise<void> {
    const url = `${this.storeBaseUrl}/cart/@self`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.buildHeaders(auth),
    });

    // 404 = no active cart — treat as success (already gone).
    if (!response.ok && response.status !== 404) {
      throw new Error(
        `HCL deleteCart error ${response.status} ${response.statusText}`,
      );
    }
  }

  /**
   * Apply a promotion/coupon code to the cart.
   * POST /wcs/resources/store/{storeId}/cart/@self/assigned_promotion_code
   */
  async addPromotionCode(
    code: string,
    auth?: HclWcsAuthHeaders,
  ): Promise<void> {
    const url = `${this.storeBaseUrl}/cart/@self/assigned_promotion_code`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.buildHeaders(auth),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ promoCode: code }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HCL addPromotionCode error ${response.status}: ${text}`);
    }
  }

  /**
   * Remove a promotion/coupon code from the cart.
   * DELETE /wcs/resources/store/{storeId}/cart/@self/assigned_promotion_code/{code}
   */
  async removePromotionCode(
    code: string,
    auth?: HclWcsAuthHeaders,
  ): Promise<void> {
    const url = `${this.storeBaseUrl}/cart/@self/assigned_promotion_code/${encodeURIComponent(code)}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.buildHeaders(auth),
    });

    if (!response.ok && response.status !== 404) {
      const text = await response.text();
      throw new Error(
        `HCL removePromotionCode error ${response.status}: ${text}`,
      );
    }
  }

  /**
   * Get available shipping modes for the current cart.
   * GET /wcs/resources/store/{storeId}/cart/@self/shipping_info
   */
  async getShippingModes(
    opts?: { langId?: string },
    auth?: HclWcsAuthHeaders,
  ): Promise<HclWcsShipModesResponse> {
    const params = new URLSearchParams();
    params.set('profileName', 'IBM_usableShippingMode');
    if (opts?.langId) params.set('langId', opts.langId);
    const url = `${this.storeBaseUrl}/cart/@self/shipping_info?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(auth),
    });

    if (!response.ok) {
      throw new Error(
        `HCL getShippingModes error ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<HclWcsShipModesResponse>;
  }

  /**
   * Set the shipping mode (and optionally an inline address) on the cart.
   * PUT /wcs/resources/store/{storeId}/cart/@self/shipping_info
   */
  async setShippingInfo(
    body: {
      shipModeId?: string;
      /** Cart item IDs to apply the shipping mode to. */
      orderItemId?: string[];
      /** Inline shipping address (alternative to address book). */
      x_addr?: HclWcsAddress;
    },
    auth?: HclWcsAuthHeaders,
  ): Promise<HclWcsOrderIdContainer> {
    const url = `${this.storeBaseUrl}/cart/@self/shipping_info`;
    const payload = {
      ...body,
      x_calculateOrder: '1',
      x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...this.buildHeaders(auth),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HCL setShippingInfo error ${response.status}: ${text}`);
    }

    return response.json() as Promise<HclWcsOrderIdContainer>;
  }

  /**
   * Set a shipping address inline on each order item.
   * PUT /wcs/resources/store/{storeId}/cart/@self/shipping_info
   * Uses the nested `orderItem[].x_addr` format required by WCS.
   */
  async setShippingAddressForItems(
    orderItemIds: string[],
    addr: HclWcsAddress,
    auth?: HclWcsAuthHeaders,
  ): Promise<HclWcsOrderIdContainer> {
    const url = `${this.storeBaseUrl}/cart/@self/shipping_info`;
    const payload = {
      x_calculateOrder: '1',
      x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
      orderItem: orderItemIds.map((orderItemId) => ({
        orderItemId,
        x_addr: addr,
      })),
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...this.buildHeaders(auth),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `HCL setShippingAddressForItems error ${response.status}: ${text}`,
      );
    }

    return response.json() as Promise<HclWcsOrderIdContainer>;
  }

  /**
   * Get available payment methods for the current cart.
   * GET /wcs/resources/store/{storeId}/cart/@self/payment_instruction/eligible_payment_info
   */
  async getPaymentMethods(
    auth?: HclWcsAuthHeaders,
  ): Promise<HclWcsPaymentMethodsResponse> {
    const url = `${this.storeBaseUrl}/cart/@self/payment_instruction/eligible_payment_info`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.buildHeaders(auth),
    });

    // Some WCS versions do not expose this endpoint — treat 404 as empty list.
    if (response.status === 404) {
      return { usablePaymentInformation: [] };
    }

    if (!response.ok) {
      throw new Error(
        `HCL getPaymentMethods error ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<HclWcsPaymentMethodsResponse>;
  }

  /**
   * Add a payment instruction to the cart.
   * POST /wcs/resources/store/{storeId}/cart/@self/payment_instruction
   *
   * Billing address can be provided as an address-book reference (`billing_address_id`)
   * or inline via WCS `billto_*` fields (for guests without an address book).
   */
  async addPaymentInstruction(
    body: {
      payMethodId: string;
      piAmount?: string;
      protocolData?: { name: string; value: string }[];
      /** Address-book ID for the billing address (registered users). */
      billing_address_id?: string;
      /** Inline billing address fields (guest users, no address book). */
      billto_firstName?: string;
      billto_lastName?: string;
      billto_address1?: string;
      billto_city?: string;
      billto_state?: string;
      billto_zipCode?: string;
      billto_country?: string;
      billto_phone1?: string;
      billto_email1?: string;
    },
    auth?: HclWcsAuthHeaders,
  ): Promise<{ piId: string }> {
    const url = `${this.storeBaseUrl}/cart/@self/payment_instruction`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.buildHeaders(auth),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `HCL addPaymentInstruction error ${response.status}: ${text}`,
      );
    }

    return response.json() as Promise<{ piId: string }>;
  }

  /**
   * Delete a payment instruction from the cart.
   * DELETE /wcs/resources/store/{storeId}/cart/@self/payment_instruction/{piId}
   */
  async deletePaymentInstruction(
    piId: string,
    auth?: HclWcsAuthHeaders,
  ): Promise<void> {
    const url = `${this.storeBaseUrl}/cart/@self/payment_instruction/${encodeURIComponent(piId)}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.buildHeaders(auth),
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(
        `HCL deletePaymentInstruction error ${response.status} ${response.statusText}`,
      );
    }
  }

  /**
   * Pre-checkout validation — must be called before checkout().
   * PUT /wcs/resources/store/{storeId}/cart/@self/precheckout
   */
  async precheckout(auth?: HclWcsAuthHeaders): Promise<HclWcsOrderIdContainer> {
    const url = `${this.storeBaseUrl}/cart/@self/precheckout`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...this.buildHeaders(auth),
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HCL precheckout error ${response.status}: ${text}`);
    }

    return response.json() as Promise<HclWcsOrderIdContainer>;
  }

  /**
   * Submit the cart as an order.
   * POST /wcs/resources/store/{storeId}/cart/@self/checkout
   * The returned orderId is the same as the cart's orderId (WCS = same entity).
   */
  async checkout(auth?: HclWcsAuthHeaders): Promise<HclWcsOrderIdContainer> {
    const url = `${this.storeBaseUrl}/cart/@self/checkout`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.buildHeaders(auth),
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HCL checkout error ${response.status}: ${text}`);
    }

    return response.json() as Promise<HclWcsOrderIdContainer>;
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
