import type { components } from './ucp-shopping.openapi.js';
import type {
  ReactionaryUCPClient,
  ReactionaryUCPProfile,
  ReactionaryUCPProfileOptions,
} from './reactionary-ucp-common.js';
import { getCapability, hasCapability } from './reactionary-ucp-capabilities.js';

type UCPCapability = components['schemas']['$defs-base'];

export function getRequestRoute(
  request: Request,
  profile: ReactionaryUCPProfileOptions | undefined,
): { path: string } {
  const url = new URL(request.url);
  const endpointPath = profile ? new URL(profile.endpoint).pathname.replace(/\/$/, '') : '';

  if (endpointPath && url.pathname.startsWith(`${endpointPath}/`)) {
    return {
      path: url.pathname.slice(endpointPath.length) || '/',
    };
  }

  return {
    path: url.pathname,
  };
}

export function createUCPProfile(
  client: ReactionaryUCPClient,
  profile: ReactionaryUCPProfileOptions | undefined,
): ReactionaryUCPProfile {
  const endpoint = profile?.endpoint ?? 'http://localhost/ucp';

  return {
    ucp: {
      version: '2026-08-25',
      services: profile?.services ?? {
        'dev.ucp.shopping': [
          {
            version: '2026-08-25',
            transport: 'rest',
            endpoint,
          },
        ],
      },
      capabilities: profile?.capabilities ?? createUcpCapabilities(client),
      ...(profile?.paymentHandlers ? { payment_handlers: profile.paymentHandlers } : {}),
    },
    keys: profile?.keys ?? [],
    merchant: profile?.merchant ?? {
      name: 'Reactionary',
      url: endpoint,
      contact: {
        email: 'support@example.com',
      },
    },
  };
}

function createUcpCapabilities(
  client: ReactionaryUCPClient,
): Record<string, UCPCapability[]> {
  const capabilities: Record<string, UCPCapability[]> = {};

  if (hasCapability(client, 'product-search')) {
    capabilities['dev.ucp.shopping.catalog.search'] = [createUcpCapability()];
  }

  if (hasCapability(client, 'product')) {
    capabilities['dev.ucp.shopping.catalog.lookup'] = [createUcpCapability()];
  }

  if (hasCapability(client, 'cart')) {
    capabilities['dev.ucp.shopping.cart'] = [createUcpCapability()];
    const cart = getCapability(client, 'cart');
    if (cart && typeof Reflect.get(cart, 'applyCouponCode') === 'function') {
      capabilities['dev.ucp.shopping.discount'] = [createUcpCapability()];
    }
  }

  if (hasCapability(client, 'checkout')) {
    capabilities['dev.ucp.shopping.checkout'] = [createUcpCapability()];
  }

  if (hasCapability(client, 'order')) {
    capabilities['dev.ucp.shopping.order'] = [createUcpCapability()];
  }

  return capabilities;
}

function createUcpCapability(): UCPCapability {
  return {
    version: '2026-08-25',
  };
}
