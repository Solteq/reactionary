# @reactionary/ucp

Framework shell for exposing Reactionary through a Universal Commerce Protocol (UCP) HTTP surface.

This package exposes a thin Universal Commerce Protocol (UCP) HTTP surface on top of an instantiated Reactionary client. The first implementation keeps the wire format small and explicit: `GET` discovers available actions from the capabilities present on the client, and `POST` invokes one action with a JSON payload.

## Design goals

- Keep Reactionary core protocol-neutral.
- Accept a Reactionary client factory instead of a singleton client.
- Create a fresh `RequestContext` per request.
- Persist only `RequestContext.session` between requests for the same UCP session.
- Let host applications mount the handler in Next.js, Node, Express, or another HTTP framework.

## Usage

```ts
import { ReactionaryUCPServer } from '@reactionary/ucp';

const ucp = new ReactionaryUCPServer((requestContext) =>
  createReactionaryClient({ contextOverrides: requestContext }),
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

- `GET` / `HEAD` returns a readiness document with the available action catalog.
- `OPTIONS` returns allowed methods.
- `POST` invokes an available UCP action.

## Action discovery

The server discovers actions from decorated Reactionary capabilities exposed by the client returned from the factory. This uses the same runtime metadata path as `@reactionary/mcp`: capabilities that extend `BaseCapability` and annotate methods with `@Reactionary({ inputSchema, outputSchema })` become UCP actions.

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
