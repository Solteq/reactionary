import type { Cache, Cart, Checkout, Client, FacetValueIdentifier, Inventory, Order, Product, ProductSearchResult, Profile, RequestContext, Result, ShippingMethod } from '@reactionary/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { components } from './ucp-shopping.openapi.js';
import type { ReactionaryUCPIdentityOptions } from './reactionary-ucp-identity.js';
import type { ReactionaryUCPLocalizationOptions } from './reactionary-ucp-localization.js';
import type { ReactionaryUCPWebhookOptions } from './reactionary-ucp-webhooks.js';
import type { UCPInventoryOptions, UCPPaymentAuthorizationWait, UCPTestPaymentHandler } from './reactionary-ucp-checkout-session.js';

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
  inventory?: {
    getBySKU: UCPMethod<Client['inventory']['getBySKU'], Inventory>;
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
  /**
   * Payment handlers that exist only for testing, e.g. the UCP conformance
   * suite's hardcoded `mock_payment_handler`. Each is accepted on checkout
   * sessions without being advertised, and its payments are placed through
   * its delegate — an advertised handler — with the credential it resolves.
   * The server logs a prominent warning while any is set. Intended for
   * conformance and test environments.
   */
  testPaymentHandlers?: UCPTestPaymentHandler[];
  /**
   * Checks checkout session line items against these fulfillment centers'
   * combined stock, reporting `out_of_stock` per line item. Unset (the
   * default), stock is left to the backend.
   */
  inventory?: UCPInventoryOptions;
  /**
   * Accepts PUT /orders/{id} with fulfillment events and adjustments for
   * orders placed through a UCP checkout session, and reports them on the
   * order — a stand-in for the business posting order updates, as the UCP
   * conformance suite expects. Not part of the UCP specification; any agent
   * that can read an order could rewrite its history. The server logs a
   * prominent warning while it is set. Intended for conformance and test
   * environments.
   */
  testOrderUpdates?: boolean;
  /**
   * Sends order events (created, and every update) to the webhook URL the
   * platform declares in its profile, as the order capability requires.
   * Unset (the default), no webhooks are sent and agent profiles are never
   * fetched.
   */
  webhooks?: ReactionaryUCPWebhookOptions;
  /**
   * Enables POST /testing/simulate-shipping/{orderId}, guarded by this value
   * in the Simulation-Secret header: records a shipment of the order and
   * sends the update webhook. Not part of the UCP specification. The server
   * logs a prominent warning while it is set. Intended for conformance and
   * test environments.
   */
  testSimulationSecret?: string;
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
