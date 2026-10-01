# @reactionary/ucp

Framework shell for exposing Reactionary through a Universal Commerce Protocol (UCP) HTTP surface.

This package exposes a thin Universal Commerce Protocol (UCP) HTTP surface on top of an instantiated Reactionary client. It serves the UCP discovery profile, a canonical Shopping REST surface, and a small Reactionary-native action catalog for diagnostics and project-specific extensions.

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
- `GET` / `HEAD` on the mounted handler returns a diagnostic readiness document with the available Reactionary action catalog.
- `OPTIONS` returns allowed methods.
- `POST` on the mounted handler invokes a diagnostic Reactionary-native action.

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

`PUT /carts/{id}` is implemented as a best-effort reconciliation against the current authoritative cart. It fetches the cart, removes existing SKUs absent from the request, changes quantities for existing SKUs, adds new SKUs, and returns the latest cart from the final mutation.

`PUT /checkout-sessions/{id}` is implemented as a constrained composed update. Today it applies selected delegated payment instruments through `checkout.addPaymentInstruction` and returns the updated checkout. UCP fields that do not yet have a Reactionary checkout mutation, such as buyer/contact replacement or full payment-instruction replacement, are intentionally ignored rather than represented as successful core updates.

`POST /checkout-sessions/{id}/cancel` is routed but currently returns a structured UCP error because checkout cancellation is not represented by Reactionary's current core checkout capabilities.

REST requests may include:

- `Request-Id`: echoed in the response header.
- `Idempotency-Key`: supported for mutating REST endpoints and stored in the UCP session cache. Reusing a key with a different mutation payload returns `409`.

## Action discovery

The diagnostic action catalog discovers actions from decorated Reactionary capabilities exposed by the client returned from the factory. This uses the same runtime metadata path as `@reactionary/mcp`: capabilities that extend `BaseCapability` and annotate methods with `@Reactionary({ inputSchema, outputSchema })` become UCP actions.

The advertised schemas are generated from the **configured capability instance**, not from hardcoded UCP schema references. If a project overrides a capability or factory schema, UCP discovery reflects that configured schema.

For example, a configured client with `product-search.queryByTerm` and `cart.add` exposes `product.search` and `cart.add_item`.

```json
{
  "name": "@reactionary/ucp",
  "version": "0.0.1",
  "protocol": "ucp",
  "status": "ready",
  "actions": [
    {
      "name": "product.search",
      "title": "Search products",
      "description": "Search the product catalog by term, facets, filters, and pagination options.",
      "capability": "product-search",
      "method": "queryByTerm",
      "inputSchema": {
        "type": "object",
        "properties": {
          "term": {
            "type": "string"
          }
        }
      },
      "outputSchema": {
        "type": "object"
      },
      "mutates": false,
      "idempotent": true,
      "requiresAuth": false,
      "riskLevel": "low"
    }
  ]
}
```

## Invoking actions

`POST` accepts an action name and a payload. The payload is passed through to the corresponding Reactionary capability method.

```json
{
  "request_id": "agent-request-1",
  "action": "product.search",
  "payload": {
    "term": "shoes",
    "facets": [],
    "filters": [],
    "paginationOptions": {
      "pageNumber": 1,
      "pageSize": 10
    }
  }
}
```

Responses preserve the Reactionary `Result` shape and include the invoked action name:

```json
{
  "request_id": "agent-request-1",
  "action": "product.search",
  "success": true,
  "value": {
    "items": []
  },
  "meta": {
    "trace": "",
    "cache": {
      "hit": false,
      "key": ""
    }
  }
}
```

Unavailable actions return `404 UCP_ACTION_NOT_AVAILABLE`. Invalid requests return `400 INVALID_UCP_ACTION_REQUEST`.

## Request IDs and idempotency

`request_id` is optional and echoed in the response so agents can correlate calls and responses.

Mutating actions also support an optional `idempotency_key`:

```json
{
  "request_id": "agent-request-2",
  "action": "cart.add_item",
  "idempotency_key": "add-sku-1",
  "payload": {
    "sku": "sku-1",
    "quantity": 1
  }
}
```

When a mutating action is called with an `idempotency_key`, the action outcome is cached in the current UCP session storage. Repeating the same mutating action with the same key in the same session replays the cached outcome instead of invoking the provider again. The replay still echoes the current `request_id`.

Reusing the same idempotency key for a different mutating action in the same session returns `409 IDEMPOTENCY_KEY_CONFLICT`.

Idempotency records use the same TTL and cache backend as UCP session state. For the intended agent flow, a session is expected to be short-lived and contain a small number of requests.

## Default action names

The current default aliases mirror existing Reactionary capability methods. Any decorated capability method without a friendly alias is still discoverable as `<capability>.<method>`.

| UCP action | Reactionary capability method |
| --- | --- |
| `product.search` | `product-search.queryByTerm` |
| `product.get_by_id` | `product.getById` |
| `product.get_by_slug` | `product.getBySlug` |
| `product.get_by_sku` | `product.getBySKU` |
| `cart.get` | `cart.getById` |
| `cart.get_active_id` | `cart.getActiveCartId` |
| `cart.list` | `cart.listCarts` |
| `cart.create` | `cart.createCart` |
| `cart.add_item` | `cart.add` |
| `cart.remove_item` | `cart.remove` |
| `cart.change_quantity` | `cart.changeQuantity` |
| `cart.delete` | `cart.deleteCart` |
| `cart.rename` | `cart.renameCart` |
| `cart.apply_coupon` | `cart.applyCouponCode` |
| `cart.remove_coupon` | `cart.removeCouponCode` |
| `cart.change_currency` | `cart.changeCurrency` |
| `checkout.initiate` | `checkout.initiateCheckoutForCart` |
| `checkout.get` | `checkout.getById` |
| `checkout.set_shipping_address` | `checkout.setShippingAddress` |
| `checkout.list_shipping_methods` | `checkout.getAvailableShippingMethods` |
| `checkout.list_payment_methods` | `checkout.getAvailablePaymentMethods` |
| `checkout.add_payment_instruction` | `checkout.addPaymentInstruction` |
| `checkout.remove_payment_instruction` | `checkout.removePaymentInstruction` |
| `checkout.set_shipping_instruction` | `checkout.setShippingInstruction` |
| `checkout.finalize` | `checkout.finalizeCheckout` |
