import type { components } from './ucp-shopping.openapi.js';
import type {
  ReactionaryUCPClient,
  ReactionaryUCPProfile,
  ReactionaryUCPProfileOptions,
} from './reactionary-ucp-common.js';
import { getCapability, hasCapability } from './reactionary-ucp-capabilities.js';

type UCPCapability = components['schemas']['$defs-base'];

const UCP_DOCS_BASE_URL = 'https://ucp.dev/2026-08-25';

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
  identityScopes?: string[],
): ReactionaryUCPProfile {
  const endpoint = profile?.endpoint ?? 'http://localhost/ucp';
  const capabilities = profile?.capabilities ?? createUcpCapabilities(client);

  if (identityScopes) {
    capabilities['dev.ucp.common.identity_linking'] = [
      {
        version: '2026-08-25',
        spec: `${UCP_DOCS_BASE_URL}/specification/common/identity-linking/`,
        schema: `${UCP_DOCS_BASE_URL}/schemas/common/identity_linking.json`,
        config: {
          scopes: identityScopes,
        },
      },
    ];
  }

  return {
    ucp: {
      version: '2026-08-25',
      services: profile?.services ?? {
        'dev.ucp.shopping': [
          {
            version: '2026-08-25',
            transport: 'rest',
            endpoint,
            spec: `${UCP_DOCS_BASE_URL}/specification/overview/`,
            schema: `${UCP_DOCS_BASE_URL}/services/shopping/rest.openapi.json`,
          },
        ],
      },
      capabilities,
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
    capabilities['dev.ucp.shopping.catalog.search'] = [createUcpCapability('catalog/search', 'catalog_search')];
  }

  if (hasCapability(client, 'product')) {
    capabilities['dev.ucp.shopping.catalog.lookup'] = [createUcpCapability('catalog/lookup', 'catalog_lookup')];
  }

  if (hasCapability(client, 'cart')) {
    capabilities['dev.ucp.shopping.cart'] = [createUcpCapability('cart', 'cart')];
    const cart = getCapability(client, 'cart');
    if (cart && typeof Reflect.get(cart, 'applyCouponCode') === 'function') {
      capabilities['dev.ucp.shopping.discount'] = [createUcpCapability('extensions/discount', 'discount')];
    }
  }

  if (hasCapability(client, 'checkout')) {
    capabilities['dev.ucp.shopping.checkout'] = [createUcpCapability('checkout', 'checkout')];
  }

  if (hasCapability(client, 'order')) {
    capabilities['dev.ucp.shopping.order'] = [createUcpCapability('order', 'order')];
  }

  return capabilities;
}

function createUcpCapability(specPath: string, schemaName: string): UCPCapability {
  return {
    version: '2026-08-25',
    spec: `${UCP_DOCS_BASE_URL}/specification/shopping/${specPath}/`,
    schema: `${UCP_DOCS_BASE_URL}/schemas/shopping/${schemaName}.json`,
  };
}
