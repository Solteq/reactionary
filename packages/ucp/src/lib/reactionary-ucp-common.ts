import type { Cache, Cart, Checkout, Client, FacetValueIdentifier, Order, Product, ProductSearchResult, Profile, RequestContext, Result, ShippingMethod } from '@reactionary/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { components } from './ucp-shopping.openapi.js';
import type { ReactionaryUCPIdentityOptions } from './reactionary-ucp-identity.js';
import type { ReactionaryUCPLocalizationOptions } from './reactionary-ucp-localization.js';
import type { UCPPaymentAuthorizationWait } from './reactionary-ucp-checkout-session.js';

type UCPService = components['schemas']['base'];
type UCPCapability = components['schemas']['$defs-base'];
// The generated payment handler type intersects with Record<string, never>, which no object literal can satisfy.
export type UCPPaymentHandler = components['schemas']['entity'] & {
  available_instruments?: components['schemas']['available_payment_instrument'][];
};
export type UCPPaymentHandlers = Record<string, UCPPaymentHandler[]>;

export interface ReactionaryUCPProfile {
  ucp: {
    version: string;
    services: Record<string, UCPService[]>;
    capabilities: Record<string, UCPCapability[]>;
    payment_handlers?: UCPPaymentHandlers;
  };
  keys: Array<Record<string, unknown>>;
  merchant: {
    name: string;
    url: string;
    contact: {
      email: string;
      phone_number?: string;
    };
  };
}

type UCPMethod<TMethod extends (payload: never) => Promise<unknown>, TValue> = (
  payload: Parameters<TMethod>[0],
) => Promise<Result<TValue, unknown>>;

export type ReactionaryUCPClient = object & {
  productSearch?: {
    createCategoryNavigationFilter?: UCPMethod<Client['productSearch']['createCategoryNavigationFilter'], FacetValueIdentifier>;
    queryByTerm: UCPMethod<Client['productSearch']['queryByTerm'], ProductSearchResult>;
  };
  product?: {
    getById: UCPMethod<Client['product']['getById'], Product>;
    getBySKU: UCPMethod<Client['product']['getBySKU'], Product>;
  };
  cart?: {
    add: UCPMethod<Client['cart']['add'], Cart>;
    changeQuantity: UCPMethod<Client['cart']['changeQuantity'], Cart>;
    createCart: UCPMethod<Client['cart']['createCart'], Cart>;
    deleteCart: UCPMethod<Client['cart']['deleteCart'], void>;
    getById: UCPMethod<Client['cart']['getById'], Cart>;
    remove: UCPMethod<Client['cart']['remove'], Cart>;
  };
  checkout?: {
    addPaymentInstruction: UCPMethod<Client['checkout']['addPaymentInstruction'], Checkout>;
    finalizeCheckout: UCPMethod<Client['checkout']['finalizeCheckout'], Checkout>;
    getById: UCPMethod<Client['checkout']['getById'], Checkout>;
    initiateCheckoutForCart: UCPMethod<Client['checkout']['initiateCheckoutForCart'], Checkout>;
    // Optional so clients without fulfillment support keep satisfying the type.
    getAvailableShippingMethods?: UCPMethod<Client['checkout']['getAvailableShippingMethods'], ShippingMethod[]>;
    setShippingAddress?: UCPMethod<Client['checkout']['setShippingAddress'], Checkout>;
    setShippingInstruction?: UCPMethod<Client['checkout']['setShippingInstruction'], Checkout>;
  };
  order?: {
    getById: UCPMethod<Client['order']['getById'], Order>;
  };
  profile?: {
    getById: UCPMethod<Client['profile']['getById'], Profile>;
  };
};

export type ReactionaryUCPClientFactory<TClient extends ReactionaryUCPClient = ReactionaryUCPClient> = (
  requestContext: RequestContext,
) => TClient;

export interface ReactionaryUCPServerOptions {
  sessionCache?: Cache;
  sessionTtlSeconds?: number;
  profile?: ReactionaryUCPProfileOptions;
  identity?: ReactionaryUCPIdentityOptions;
  /**
   * Maps buyer signals (UCP `context.address_country`, `Accept-Language`) to a
   * language context. Without it, every request uses the client factory's
   * initial context. The negotiated context sticks to the UCP session.
   */
  localization?: ReactionaryUCPLocalizationOptions;
  /**
   * Email used to price transient checkouts before the buyer has supplied
   * one (backends require an email to quote shipping and tax). Never used for
   * the real checkout created on completion. Defaults to
   * `pending@checkout.invalid` — `.invalid` is a reserved, undeliverable TLD.
   */
  placeholderEmail?: string;
  /**
   * Email used to place REAL orders when the agent never supplied a buyer
   * email and no identity is logged in. Unset (the default), such completions
   * answer `incomplete` asking for `$.buyer.email`. Setting it lets anonymous
   * agent checkouts complete, but the buyer cannot be sent a receipt, which
   * may be illegal in some jurisdictions — the server logs a prominent
   * warning while it is set. Intended for conformance and test environments.
   */
  anonymousOrderEmail?: string;
  /**
   * How long checkout completion waits for the placed checkout to become
   * `readyForFinalization` (i.e. its payment authorized, e.g. by a PSP
   * webhook) before answering `complete_in_progress`. Defaults to 10s
   * timeout, polled every 1s.
   */
  paymentAuthorizationWait?: Partial<UCPPaymentAuthorizationWait>;
}

export interface ReactionaryUCPProfileOptions {
  endpoint: string;
  merchant: ReactionaryUCPProfile['merchant'];
  keys: ReactionaryUCPProfile['keys'];
  services?: ReactionaryUCPProfile['ucp']['services'];
  capabilities?: ReactionaryUCPProfile['ucp']['capabilities'];
  paymentHandlers?: ReactionaryUCPProfile['ucp']['payment_handlers'];
}

export interface ReactionaryUCPHttpHandler {
  fetch(request: Request): Promise<Response>;
  close(): Promise<void>;
}

export type ReactionaryUCPNodeRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;
