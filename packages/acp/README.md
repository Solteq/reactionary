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

## Protocol version

The adapter implements ACP API version `2026-04-17` only. Checkout requests must send `API-Version: 2026-04-17`; requests without it, or with another version, are rejected with `400` and code `missing_api_version` / `unsupported_api_version`, listing `supported_versions`.

## Authentication

ACP requires agents to authenticate with `Authorization: Bearer <token>`. Configure `authenticate` with a function returning the calling agent (or `undefined` for 401); `createBearerTokenAuthenticator({ agentId: token })` covers static per-agent tokens, and request-signature checks can be added in the same hook. A checkout session is visible only to the agent that created it — others get 404. Discovery and the readiness document stay public. Without `authenticate` the checkout endpoints are open and a warning is logged.

## Idempotency

Every checkout `POST` must carry an `Idempotency-Key` (at most 255 characters), scoped to the authenticated agent and endpoint. Repeating a request with the same key and a semantically equal JSON body returns the stored response with `Idempotent-Replayed: true` and no side effects; a different body answers `422 idempotency_conflict`, and a key still being processed `409 idempotency_in_flight` with `Retry-After`. Missing keys answer `400 idempotency_key_required`. Responses are kept for `idempotencyTtlSeconds` (at least 24 hours) in `sessionCache`; server errors are never stored. Concurrent requests are serialized per instance; across instances the in-flight marker in the shared cache is best effort, as the `Cache` interface has no atomic insert.

## Discovery

`GET /.well-known/acp.json` (alias `/.well-known/acp`) serves the ACP discovery document with `Cache-Control: public, max-age=3600`. It advertises protocol version `2026-04-17` and the `checkout` service (the services enum is closed per version: `checkout`, `orders`, `delegate_payment`, `carts`), the `intervention_types` of the `interventions` option, and the extensions the server implements. `api_base_url` defaults to the request origin plus `basePath` (default `/acp`); override it and other fields with the `discovery` option. The host application must route the well-known path to this handler. Payment handlers are not part of ACP discovery; they are negotiated per checkout session.

## Product feeds

ACP feeds are **pushed** by the merchant to the agent's Feed API (2026-04-17); agents never pull feeds from merchants. `ReactionaryACPFeedPublisher` generates the feed with `@reactionary/feeds` and pushes it:

```ts
import { ReactionaryACPFeedPublisher } from '@reactionary/acp';

const publisher = new ReactionaryACPFeedPublisher(createClient, {
  feedApiBaseUrl: 'https://agent.example/api',
  apiKey: process.env.ACP_FEED_API_KEY,
  feeds: {
    finnish: {
      languageContext: { locale: 'fi-FI', currencyCode: 'EUR' },
      search: { term: '', facets: [], filters: ['market:fi'], paginationOptions: { pageNumber: 1, pageSize: 50 } },
      productUrlBase: 'https://shop.example/{lang}/products/{slug}',
    },
  },
});

const feed = await publisher.createFeed('finnish'); // POST /feeds
await publisher.publish('finnish', feed.id);        // PATCH /feeds/{id}/products, in batches
```

Each feed definition provides the `languageContext` the products are generated in, the `search` passed to `productSearch.queryByTerm`, and `productUrlBase` (a base URL or a template with `{lang}` and `{slug}`). Products are ACP `Product` records with their variants (see the `acp-product-feed` transformer in `@reactionary/feeds`). Upserts never remove products; for a full replacement, use file ingestion: the `@reactionary/feeds` CLI writes `products.jsonl` (`acp-product-feed`) and `metadata.json` (`acp-feed-metadata`).

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
- `checkout.setShippingInstruction`
- `checkout.addPaymentInstruction`
- `checkout.finalizeCheckout`
- `product.getBySKU`

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

- ACP item `id` maps to Reactionary `ProductVariantIdentifier.sku`. Requests send `line_items`; an item's optional `quantity` (decimal, default 1) is outside the 2026-04-17 `Item` schema but accepted as the checkout RFC sends it, and repeated ids add up.
- The buyer follows the 2026-04-17 `Buyer` schema (`email` required; names, phone, company, loyalty and tax exemption optional). Buyer updates are merged into what the session already holds.
- `fulfillment_details` (contact and nested address) is the shipping address; its email and phone stand in for the buyer's. `selected_fulfillment_options` picks the backend shipping method (one per checkout, so the first selection applies to all line items). `null` clears either field.
- Create requests must declare the agent's `capabilities`. Every session response returns the negotiated `capabilities`: `interventions.supported` is the intersection of the agent's declaration with the `interventions` server option (none by default), plus the seller's `required` interventions and `enforcement`. A required intervention the agent lacks, enforced `always`, blocks the session with an `intervention_required` message.
- Responses echo `Request-Id`, and `Idempotency-Key` on POSTs. When `discovery.supportedLocales` is set, requests are localized to the best match of their `Accept-Language` (exact tag, else same language); other locales are ignored.
- Sessions report what is still needed in `messages[]`: `missing` buyer email, shipping address or fulfillment option, an `invalid` (unavailable) fulfillment option, and — with the `inventory` option's fulfillment centers — `out_of_stock` line items. Each carries its JSONPath `param` and a `resolution`; any error keeps the session `not_ready_for_payment`, and completing such a session answers 400 with the first blocking message.
- Completion waits up to `paymentAuthorizationWait` for the backend to authorize the payment. If it is still pending, the session answers `complete_in_progress` without an order and with an info message; retrieving the session (or completing again with a new `Idempotency-Key`) reports `completed` with the order once the backend has it. `completed` always carries the order.
- Completed sessions carry `order { type, id, checkout_session_id, permalink_url }`; `permalink_url` comes from the `orderPermalinkUrl` template (`{orderId}` placeholder). Without it the permalink is omitted and a warning is logged.
- When the backend offers no fulfillment option for an address, the session reports `region_restricted` and cannot become payable — unless `requireFulfillment: false` (stores selling only goods that need no shipping).
- 3D Secure: with the `authentication` option, `getMetadata(...)` decides per completion whether issuer authentication is needed. If so, completion answers `authentication_required` with `authentication_metadata`; completing again without `authentication_result` is `400 requires_3ds`, an unsuccessful outcome is not authorized (`payment_declined` message), and a successful one is passed to the backend as protocol data `acp_authentication_result`. Updating the session drops a pending authentication.
- Discount extension: when the client supports `cart.applyCouponCode`/`removeCouponCode` and the agent declares `discount` in `capabilities.extensions`, sessions activate the extension. `discounts.codes` (or the deprecated `coupons`) replace the submitted codes (case-insensitive, `[]` clears); responses carry `discounts { codes, applied, rejected }` and a `discount_code_invalid` warning per rejected code. Discovery lists the `discount` extension.
- A declined payment answers the session (200) still `ready_for_payment`, with a `payment_declined` error message, so the agent can retry with another instrument; the declined backend checkout is discarded.
- The create request's `currency` sets the request context currency for the session's lifetime.
- ACP amounts are returned as integer minor units.
- Line items report `item.id` (the SKU), `quantity`, `unit_amount` and a `totals[]` breakdown (`items_base_amount`, `discount`, `subtotal`, `total`), plus `name`, `description`, `images`, `product_id`, `sku` and `variant_options` from `product.getBySKU`. Per-line tax is not known to the cart and is not reported.
- Feed variant `price` comes from `price.getCustomerPrice` (active customer/global campaign prices, falling back to list prices in providers), `list_price` from `price.getListPrice` when it is higher, and availability from `inventory.getBySKU`.
- Completion takes `payment_data { handler_id, instrument { type, credential { type, token } }, billing_address? }`. The handler must be one advertised in `paymentHandlers`; the credential token is passed to the backend as payment-instruction protocol data `delegated_payment_token` (with `delegated_payment_provider` = the handler's PSP, plus `acp_payment_handler_id`, `acp_payment_instrument_type`, `acp_payment_credential_type`). `billing_address` becomes the checkout's billing address. Raw card credentials are refused unless `acceptRawCardCredentials` is set; purchase-order payments are not supported.
- The `links` option lists policy links (`terms_of_use`, `privacy_policy`, `return_policy`, `shipping_policy`, `contact_us`, `about_us`, `faq`, `support`, with an optional `title`) returned on every session.
- Fulfillment options are sourced from `checkout.getAvailableShippingMethods` as `shipping` options with a distinct `title`, the delivery estimate as `description`, the `carrier`, and the cost as `totals[]`.
- Payment handlers are configured with the `paymentHandlers` option and advertised in `capabilities.payment.handlers`; `createTokenizedCardHandler({ psp, merchantId })` builds the reference `dev.acp.tokenized.card` handler. Each handler maps to the backend payment method its payments are placed with (default: method `card`, name and processor = the handler's PSP). Handler configs must carry `merchant_id` and `psp`; without handlers, `capabilities.payment` is omitted.

Use `@reactionary/feeds` directly when you want Google Merchant, sitemap XML, or PriceRunner outputs from the same feed definitions.

## Order webhooks

With `webhooks: { endpoints: [{ url, secret, agentId? }] }`, orders placed through a checkout session are announced to the creating agent's receiver (`order_create`), and `server.notifyOrderUpdated(orderId)` sends `order_update` with the order's current state — call it when your OMS changes the order (ships, cancels). Events carry the full ACP `Order` (status, line items with ordered/current/fulfilled quantities, the shipping fulfillment, totals) and are signed with `Merchant-Signature: t=<unix>,v1=<HMAC-SHA256 hex of "t.body">` using the endpoint secret (`signWebhookPayload` builds the header). Failed deliveries are retried in memory (0.5s … 5m). Webhooks need the client's `order.getById`, and discovery then advertises the `orders` service.
