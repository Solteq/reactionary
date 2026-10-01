import type { Cache, RequestContext } from '@reactionary/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { components } from './ucp-shopping.openapi.js';

type UCPService = components['schemas']['base'];
type UCPCapability = components['schemas']['$defs-base'];
type UCPPaymentHandler = components['schemas']['payment_handler_$defs-base'];

export interface ReactionaryUCPProfile {
  ucp: {
    version: string;
    services: Record<string, UCPService[]>;
    capabilities: Record<string, UCPCapability[]>;
    payment_handlers?: Record<string, UCPPaymentHandler[]>;
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

export type ReactionaryUCPClient = object;

export type ReactionaryUCPClientFactory<TClient extends ReactionaryUCPClient = ReactionaryUCPClient> = (
  requestContext: RequestContext,
) => TClient;

export interface ReactionaryUCPServerOptions {
  name?: string;
  version?: string;
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
