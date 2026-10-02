# @reactionary/ucp

Framework shell for exposing Reactionary through a Universal Commerce Protocol (UCP) HTTP surface.

This package exposes a thin Universal Commerce Protocol (UCP) HTTP surface on top of an instantiated Reactionary client. It serves the UCP discovery profile and a canonical Shopping REST surface.

## Design goals

- Keep Reactionary core protocol-neutral.
- Accept a Reactionary client factory instead of a singleton client.
- Create a fresh `RequestContext` per request.
- Persist only `RequestContext.session` between requests for the same UCP session.
- Let host applications mount the handler in Next.js, Node, Express, or another HTTP framework.

## Usage

```ts
import { ReactionaryUCPServer } from '@reactionary/ucp';

const ucp = new ReactionaryUCPServer(
  (requestContext) => createReactionaryClient({ contextOverrides: requestContext }),
  {
    profile: {
      endpoint: 'https://shop.example.com/ucp',
      merchant: {
        name: 'Example shop',
        url: 'https://shop.example.com',
        contact: {
          email: 'support@example.com',
        },
      },
      keys: [
        // Public verification JWKs only. Never put private keys in the profile.
      ],
    },
  },
);

export const POST = (request: Request) => ucp.fetch(request);
export const GET = (request: Request) => ucp.fetch(request);
```

For Node HTTP:

```ts
import { createServer } from 'node:http';
import { ReactionaryUCPServer } from '@reactionary/ucp';

const ucp = new ReactionaryUCPServer(createClient);
const handler = ucp.toNodeHandler();

createServer((request, response) => {
  void handler(request, response);
}).listen(3000);
```

## Session handling

The server uses the `ucp-session-id` header. If the request does not include one, the server creates a new session id and returns it in the response.

Session state is stored through the Reactionary `Cache` interface. The default is `MemoryCache`, which is useful for local development only.

```ts
new ReactionaryUCPServer(createClient, {
  sessionCache: redisCache,
  sessionTtlSeconds: 60 * 60,
});
```

## Current behavior

- `GET /.well-known/ucp` returns a UCP discovery profile for the official Shopping REST service.
- Canonical Shopping REST endpoints are available below the configured `profile.endpoint` path.
- `OPTIONS` returns allowed methods.
- Unmatched routes return `404 NOT_FOUND`.

## UCP discovery profile

The official discovery profile is served from `/.well-known/ucp`. The profile advertises:

- `ucp.version: "2026-08-25"`
- the `dev.ucp.shopping` REST service endpoint
- capabilities derived from the configured Reactionary client
- configured merchant metadata
- configured public keys
- configured payment handlers (`profile.paymentHandlers`), if supplied; the same handlers are echoed in checkout responses' `ucp.payment_handlers`

Payment handlers are static configuration. The handler `id` is forwarded as `paymentMethod.paymentProcessor` when a payment instrument is selected, so it must match a payment provider id in the backend (for example Medusa's `pp_system_default`).

Capability advertisement is intentionally derived from the instantiated client:

| Advertised capability | Required Reactionary capability |
| --- | --- |
| `dev.ucp.shopping.catalog.search` | `product-search` |
| `dev.ucp.shopping.catalog.lookup` | `product` |
| `dev.ucp.shopping.cart` | `cart` |
| `dev.ucp.shopping.discount` | `cart.applyCouponCode` |
| `dev.ucp.shopping.checkout` | `checkout` |
| `dev.ucp.shopping.order` | `order` |

## Canonical Shopping REST endpoints

The Shopping REST request and response types are generated from the official OpenAPI document:

```bash
npx --yes -p typescript@5.9.2 -p openapi-typescript@7.10.1 \
  openapi-typescript https://ucp.dev/2026-08-25/services/shopping/rest.openapi.json \
  -o packages/ucp/src/lib/ucp-shopping.openapi.ts
```

The first REST implementation maps the endpoints that fit Reactionary's current provider model:

| Endpoint | Reactionary mapping |
| --- | --- |
| `POST /catalog/search` | `product-search.queryByTerm` |
| `POST /catalog/lookup` | `product.getById` / `product.getBySKU` |
| `POST /catalog/product` | `product.getById` / `product.getBySKU` |
| `POST /carts` | `cart.createCart` plus `cart.add` for submitted line items |
| `GET /carts/{id}` | `cart.getById` |
| `PUT /carts/{id}` | Composes `cart.getById`, `cart.remove`, `cart.changeQuantity`, and `cart.add` to reconcile line items by SKU |
| `POST /carts/{id}/cancel` | `cart.deleteCart` |
| `POST /checkout-sessions` | `checkout.initiateCheckoutForCart`; if `line_items` are supplied without `cart_id`, a cart is created first |
| `GET /checkout-sessions/{id}` | `checkout.getById` |
| `PUT /checkout-sessions/{id}` | Composes `checkout.getById` and `checkout.addPaymentInstruction` for selected delegated payment instruments |
| `POST /checkout-sessions/{id}/complete` | `checkout.finalizeCheckout` |
| `GET /orders/{id}` | `order.getById` |

`POST /catalog/search` treats the UCP `pagination.cursor` as an opaque offset encoded as a base-10 string. When present, that offset is converted to Reactionary's page-based `paginationOptions.pageNumber` using the requested `pagination.limit` as `pageSize`. Search responses include `pagination.cursor` only when another page is available; the returned cursor is the next page boundary offset.

UCP catalog search filters are mapped to Reactionary search inputs where possible:

- `filters.categories[0]` is treated as a breadcrumb string separated by `>` and resolved through `product-search.createCategoryNavigationFilter` when available. The resolved value is passed as Reactionary `categoryFilter`.
- Additional category values are ignored for now because Reactionary search has a single `categoryFilter`; the response includes a warning message when this happens.
- `filters.price` is ignored for now because Reactionary product search has no provider-neutral price filter; the response includes a warning message.
- Other extension filter keys are passed through as Reactionary string filters in `key:value` form. Array values produce one filter string per item.

`PUT /carts/{id}` is implemented as a best-effort reconciliation against the current authoritative cart. It fetches the cart, removes existing SKUs absent from the request, changes quantities for existing SKUs, adds new SKUs, and returns the latest cart from the final mutation.

`PUT /checkout-sessions/{id}` is implemented as a constrained composed update. Today it applies selected delegated payment instruments through `checkout.addPaymentInstruction` and returns the updated checkout. UCP fields that do not yet have a Reactionary checkout mutation, such as buyer/contact replacement or full payment-instruction replacement, are intentionally ignored rather than represented as successful core updates.

`POST /checkout-sessions/{id}/cancel` is routed but currently returns a structured UCP error because checkout cancellation is not represented by Reactionary's current core checkout capabilities.

REST requests may include:

- `Request-Id`: echoed in the response header.
- `Idempotency-Key`: supported for mutating REST endpoints and stored in the UCP session cache. Reusing a key with a different mutation payload returns `409`.

## Identity linking (OAuth 2.0)

Setting the optional `identity` server option turns the UCP server into a small OAuth 2.0 authorization server implementing UCP's `dev.ucp.common.identity_linking`, so an agent can act for a logged-in shopper. The agent never sees credentials; the shopper logs in on the storefront's existing login page, and the resulting Reactionary `Session` is stored behind opaque, hashed bearer tokens.

```ts
const server = new ReactionaryUCPServer(createClient, {
  sessionCache: redisCache, // optional enhancer, see below
  profile: { /* ... */ },
  identity: {
    issuer: 'https://shop.example.com',
    loginUrl: 'https://shop.example.com/account/login',
    stateSecret: process.env.UCP_OAUTH_STATE_SECRET, // 32+ chars; must be identical on all instances
    internalApiKey: process.env.UCP_OAUTH_INTERNAL_KEY, // only for split deployments
    clients: [
      {
        clientId: 'openai-shopping',
        clientSecret: process.env.OPENAI_CLIENT_SECRET, // omit for public clients (PKCE-only)
        redirectUris: ['https://agents.example-platform.com/oauth/callback'],
      },
    ],
  },
});
```

What this serves:

- `GET /.well-known/oauth-authorization-server` (RFC 8414 metadata)
- `GET {endpoint}/oauth/authorize` — validates client, exact `redirect_uri`, and PKCE S256 (mandatory for all clients), then redirects to `loginUrl` with `?ucp_request_id=...`
- `GET|POST {endpoint}/oauth/consent` — consent page (override with `renderConsentPage`) that mints the single-use authorization code
- `POST {endpoint}/oauth/token` — `authorization_code` and `refresh_token` grants
- `POST {endpoint}/oauth/revoke` — RFC 7009; revoking a refresh token kills its access tokens
- `POST {endpoint}/oauth/complete` — internal server-to-server completion (requires `internalApiKey`)

All OAuth state (authorization requests, codes, access and refresh tokens) is sealed into self-contained AES-256-GCM blobs encrypted with `stateSecret` — nothing needs to be stored for the flow to be correct, tokens survive restarts, and multiple instances only need the same `stateSecret`. The `sessionCache` is a pure enhancer; when present it adds:

- **single-use enforcement** of authorization codes and consent grants (without it, replay is bounded only by the 60s code TTL plus PKCE and client auth)
- **instant revocation** (`/oauth/revoke` keeps a deny-list; without a shared durable cache, revocation is best-effort until the token expires)
- **session freshness** (backend-session changes during bearer requests are written to a cache overlay; without it, requests fall back to the session sealed at link time)

Gated routes (default: `GET /orders/*` requires `dev.ucp.shopping.order:read`, configurable via `scopes`) answer `401` with `WWW-Authenticate: Bearer error="identity_required"` or `403 insufficient_scope`. When the stored backend session has expired, the agent receives `401` and must re-link — there is no silent re-login and no password is ever stored.

The profile at `/.well-known/ucp` automatically advertises `dev.ucp.common.identity_linking` with `config.scopes`.

### Storefront integration

The storefront owns the login UI; the library owns everything else. After its normal login succeeds, the storefront tells the UCP server "this request id belongs to this customer and session" and sends the browser to the returned `continueUrl`. There are two transports for that hand-off:

- **Embedded** (storefront mounts the UCP handler in-process): call `server.identity.completeAuthorization(...)` directly.
- **Split deployment** (UCP runs as its own Express server): `POST {endpoint}/oauth/complete` with the `x-ucp-internal-key` header, server-to-server. No shared storage is needed — state travels in sealed blobs — and the browser never sees the internal key.

The login page must honour the `ucp_request_id` query parameter: keep it through the login flow and hand it to the continue route below.

#### Next.js (App Router)

`app/ucp/oauth/continue/route.ts` — the storefront's only new code:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getReactionarySession } from '../../../lib/session'; // however the storefront restores its Session

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = request.nextUrl.searchParams.get('ucp_request_id');
  const { customerId, session } = await getReactionarySession(request);

  if (!requestId || !customerId) {
    return NextResponse.redirect(new URL('/account/login', request.url));
  }

  // Split deployment: hand the session to the standalone UCP server.
  const response = await fetch(`${process.env.UCP_BASE_URL}/oauth/complete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ucp-internal-key': process.env.UCP_OAUTH_INTERNAL_KEY ?? '',
    },
    body: JSON.stringify({ request_id: requestId, customer_id: customerId, session }),
  });

  const { continue_url: continueUrl } = (await response.json()) as { continue_url: string };
  return NextResponse.redirect(continueUrl);
}
```

Embedded variant (UCP server mounted in the same Next.js app): replace the `fetch` with

```ts
const { continueUrl } = await ucpServer.identity.completeAuthorization({
  requestId,
  customerId,
  session,
});
return NextResponse.redirect(continueUrl);
```

And the login page forwards the parameter, e.g. `app/account/login/page.tsx` redirects to `/ucp/oauth/continue?ucp_request_id=...` after a successful sign-in when the parameter is present.

#### SvelteKit

`src/routes/ucp/oauth/continue/+server.ts`:

```ts
import { redirect } from '@sveltejs/kit';
import { UCP_BASE_URL, UCP_OAUTH_INTERNAL_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const requestId = url.searchParams.get('ucp_request_id');
  const { customerId, session } = locals; // however the storefront restores its Session

  if (!requestId || !customerId) {
    redirect(302, '/account/login');
  }

  const response = await fetch(`${UCP_BASE_URL}/oauth/complete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ucp-internal-key': UCP_OAUTH_INTERNAL_KEY,
    },
    body: JSON.stringify({ request_id: requestId, customer_id: customerId, session }),
  });

  const { continue_url: continueUrl } = (await response.json()) as { continue_url: string };
  redirect(302, continueUrl);
};
```

#### Standalone Express UCP server

Redirect hops in a split deployment:

```text
agent -> UCP /oauth/authorize -> storefront /account/login?ucp_request_id=...
      -> storefront /ucp/oauth/continue (reads own session, POSTs /oauth/complete with internal key)
      -> UCP /oauth/consent (approve/deny) -> agent redirect_uri?code=...&iss=...
```

Requirements:

- No shared storage is required between the storefront and the UCP server: state travels inside sealed blobs. Give the UCP server a Redis-backed `sessionCache` to get single-use code enforcement and instant revocation across instances.
- All UCP instances must share the same `stateSecret`; rotating it invalidates every outstanding token and link-in-progress.
- Set `internalApiKey` (e.g. from `UCP_OAUTH_INTERNAL_KEY`) on the UCP server and in the storefront's environment. It is a server-to-server secret; never expose it to the browser.
- `issuer` is the public origin; `baseUrl` defaults to `{issuer}/ucp` and must match where the UCP endpoint is actually served.

## Request IDs and idempotency

`Request-Id` is optional and echoed in the response header so agents can correlate calls and responses.

Mutating REST endpoints also support an optional `Idempotency-Key` header. When a mutating REST request is called with an `Idempotency-Key`, the response is cached in the current UCP session storage. Repeating the same mutating request with the same key and payload in the same session replays the cached response instead of invoking the provider again.

Reusing the same idempotency key for a different mutating REST route or payload in the same session returns `409 idempotency_key_conflict`.

Idempotency records use the same TTL and cache backend as UCP session state. For the intended agent flow, a session is expected to be short-lived and contain a small number of requests.
