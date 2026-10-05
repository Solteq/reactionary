# @reactionary/acp

HTTP adapter for exposing Reactionary checkout capabilities through the Agentic Commerce Protocol (ACP) checkout surface.

The package keeps Reactionary core protocol-neutral: host applications mount this adapter and provide a request-scoped Reactionary client factory.

## Implemented surface

The adapter implements the merchant-hosted ACP checkout endpoints:

- `GET /product_feeds/{id}/products`
- `POST /checkout_sessions`
- `POST /checkout_sessions/{checkout_session_id}`
- `GET /checkout_sessions/{checkout_session_id}`
- `POST /checkout_sessions/{checkout_session_id}/complete`
- `POST /checkout_sessions/{checkout_session_id}/cancel`

It also serves a readiness document from `GET` / `HEAD`.

If the adapter is mounted under `/acp`, both `/checkout_sessions/...` and `/acp/checkout_sessions/...` paths are understood. Set `basePath` when mounting somewhere else.

## Protocol version

The adapter implements ACP API version `2026-04-17` only. Checkout requests must send `API-Version: 2026-04-17`; requests without it, or with another version, are rejected with `400` and code `missing_api_version` / `unsupported_api_version`, listing `supported_versions`.

## Discovery

`GET /.well-known/acp.json` (alias `/.well-known/acp`) serves the ACP discovery document with `Cache-Control: public, max-age=3600`. It advertises protocol version `2026-04-17` and the `checkout` service, plus `feeds` when `productFeed` is configured. `api_base_url` defaults to the request origin plus `basePath` (default `/acp`); override it and other fields with the `discovery` option. The host application must route the well-known path to this handler. Payment handlers are not part of ACP discovery; they are negotiated per checkout session.

## Product feed generation

`GET /product_feeds/{id}/products` generates an ACP-compatible product feed from the configured feed definition whose key matches `{id}`.

The feed enumeration and serialization pipeline is shared with `@reactionary/feeds`; this adapter keeps the ACP-compatible route shape while delegating normalization and ACP product feed output to the reusable feed package.

Each feed definition provides:

- `languageContext` — applied to the `RequestContext` before the Reactionary client is created.
- `search` — a `ProductSearchIdentifierSchema`-compatible search object passed to `productSearch.queryByTerm`.
- `productUrlBase` — either a base URL that the product slug is resolved against, or a URL template supporting `{lang}` and `{slug}` placeholders.

By default it returns the ACP JSON shape:

```json
{
  "target_country": "FI",
  "products": []
}
```

`target_country` is derived from `languageContext.locale` when the locale includes a region, e.g. `fi-FI` -> `FI`.

For file generation, request JSONL:

```bash
curl "https://example.com/acp/product_feeds/default/products?format=jsonl" > products.jsonl
```

The first implementation streams the response directly instead of generating a download URL. That keeps the adapter stateless and lets callers pipe the result to a file, object storage upload, or feed-ingestion job. A signed download URL can be layered on later by a host application or a storage-backed feed job.

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
- `productSearch.queryByTerm`
- `product.getBySKU`
- `price.getListPrice`
- `price.getCustomerPrice`
- `inventory.getBySKU`

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
  productFeed: {
    feeds: {
      finnish: {
        languageContext: {
          locale: 'fi-FI',
          currencyCode: 'EUR',
        },
        search: {
          term: '',
          facets: [],
          filters: ['market:fi'],
          paginationOptions: {
            pageNumber: 1,
            pageSize: 50,
          },
        },
        productUrlBase: 'https://shop.example/{lang}/products/{slug}',
      },
    },
  },
});
```

## Mapping notes

- ACP item `id` maps to Reactionary `ProductVariantIdentifier.sku`. Requests send `line_items`; an item's optional `quantity` (decimal, default 1) is outside the 2026-04-17 `Item` schema but accepted as the checkout RFC sends it, and repeated ids add up.
- The buyer follows the 2026-04-17 `Buyer` schema (`email` required; names, phone, company, loyalty and tax exemption optional). Buyer updates are merged into what the session already holds.
- `fulfillment_details` (contact and nested address) is the shipping address; its email and phone stand in for the buyer's. `selected_fulfillment_options` picks the backend shipping method (one per checkout, so the first selection applies to all line items). `null` clears either field.
- The create request's `currency` sets the request context currency for the session's lifetime.
- ACP amounts are returned as integer minor units.
- ACP product feed variant `price` comes from `price.getCustomerPrice`, which includes active customer/global campaign prices and can fall back to list prices in providers.
- ACP product feed variant `list_price` comes from `price.getListPrice`.
- ACP product feed availability comes from `inventory.getBySKU`.
- ACP payment data is passed as checkout payment-instruction protocol data with key `delegated_payment_token`.
- Fulfillment options are sourced from `checkout.getAvailableShippingMethods`.
- Payment provider information is sourced from `checkout.getAvailablePaymentMethods`, with a configurable fallback through `paymentProvider`.

Use `@reactionary/feeds` directly when you want Google Merchant, sitemap XML, or PriceRunner outputs from the same feed definitions.

Product-feed upsert/push APIs and order webhooks are separate ACP surfaces and are not implemented yet.
