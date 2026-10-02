import type { Cache, Cart, Checkout, Client, FacetValueIdentifier, Order, Product, ProductSearchResult, RequestContext, Result } from '@reactionary/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { components } from './ucp-shopping.openapi.js';

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
  };
  order?: {
    getById: UCPMethod<Client['order']['getById'], Order>;
  };
};

export type ReactionaryUCPClientFactory<TClient extends ReactionaryUCPClient = ReactionaryUCPClient> = (
  requestContext: RequestContext,
) => TClient;

export interface ReactionaryUCPServerOptions {
  sessionCache?: Cache;
  sessionTtlSeconds?: number;
  profile?: ReactionaryUCPProfileOptions;
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
