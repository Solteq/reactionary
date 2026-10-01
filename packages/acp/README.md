# @reactionary/acp

HTTP adapter for exposing Reactionary checkout capabilities through the Agentic Commerce Protocol (ACP) checkout surface.

The package keeps Reactionary core protocol-neutral: host applications mount this adapter and provide a request-scoped Reactionary client factory.

## Implemented surface

The adapter implements the merchant-hosted ACP checkout endpoints:

- `POST /checkout_sessions`
- `POST /checkout_sessions/{checkout_session_id}`
- `GET /checkout_sessions/{checkout_session_id}`
- `POST /checkout_sessions/{checkout_session_id}/complete`
- `POST /checkout_sessions/{checkout_session_id}/cancel`

It also serves a readiness document from `GET` / `HEAD`.

If the adapter is mounted under `/acp`, both `/checkout_sessions/...` and `/acp/checkout_sessions/...` paths are understood. Set `basePath` when mounting somewhere else.

## Required Reactionary capabilities

The server validates the supplied client during construction and on every request. If the client does not expose the operations required by ACP checkout, the server does not initialize.

Required operations:

- `cart.createCart`
- `cart.add`
- `cart.getById`
- `checkout.initiateCheckoutForCart`
- `checkout.getById`
- `checkout.setShippingAddress`
- `checkout.getAvailableShippingMethods`
- `checkout.getAvailablePaymentMethods`
- `checkout.setShippingInstruction`
- `checkout.addPaymentInstruction`
- `checkout.finalizeCheckout`

This is deliberate because Reactionary clients can be built with different capability sets. A partially capable client should fail fast instead of advertising ACP checkout.

## Usage

```ts
import { ReactionaryACPServer } from '@reactionary/acp';

const acp = new ReactionaryACPServer((requestContext) =>
  createReactionaryClient({ contextOverrides: requestContext }),
);

export const POST = (request: Request) => acp.fetch(request);
export const GET = (request: Request) => acp.fetch(request);
```

For Node HTTP:

```ts
import { createServer } from 'node:http';
import { ReactionaryACPServer } from '@reactionary/acp';

const acp = new ReactionaryACPServer(createClient);
const handler = acp.toNodeHandler();

createServer((request, response) => {
  void handler(request, response);
}).listen(3000);
```

## Session handling

The server uses two pieces of state:

- `RequestContext.session`, keyed by the `acp-session-id` header.
- ACP checkout-session state, keyed by `checkout_session_id`.

If the request does not include `acp-session-id`, the server creates a new one and returns it in the response.

State is stored through the Reactionary `Cache` interface. The default is `MemoryCache`, which is useful for local development only.

```ts
new ReactionaryACPServer(createClient, {
  sessionCache: redisCache,
  sessionTtlSeconds: 60 * 60,
  checkoutSessionTtlSeconds: 60 * 60,
});
```

## Mapping notes

- ACP item `id` maps to Reactionary `ProductVariantIdentifier.sku`.
- ACP amounts are returned as integer minor units.
- ACP payment data is passed as checkout payment-instruction protocol data with key `delegated_payment_token`.
- Fulfillment options are sourced from `checkout.getAvailableShippingMethods`.
- Payment provider information is sourced from `checkout.getAvailablePaymentMethods`, with a configurable fallback through `paymentProvider`.

Product-feed ingestion and order webhooks are separate ACP surfaces and are not implemented in this checkout adapter yet.
