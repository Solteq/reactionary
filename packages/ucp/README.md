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
- configured payment handlers, if supplied

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

## Request IDs and idempotency

`Request-Id` is optional and echoed in the response header so agents can correlate calls and responses.

Mutating REST endpoints also support an optional `Idempotency-Key` header. When a mutating REST request is called with an `Idempotency-Key`, the response is cached in the current UCP session storage. Repeating the same mutating request with the same key and payload in the same session replays the cached response instead of invoking the provider again.

Reusing the same idempotency key for a different mutating REST route or payload in the same session returns `409 idempotency_key_conflict`.

Idempotency records use the same TTL and cache backend as UCP session state. For the intended agent flow, a session is expected to be short-lived and contain a small number of requests.
