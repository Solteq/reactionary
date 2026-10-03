# UCP & ACP end-to-end integration tests

These suites exercise the `@reactionary/ucp` and `@reactionary/acp` protocol
servers end-to-end against live provider backends: full multi-request shopping
flows (discovery → search → cart → checkout), not single-call unit checks. The
servers are driven through their `fetch(Request)` handlers exactly as an HTTP
client would, including protocol session headers (`ucp-session-id` /
`acp-session-id`) and idempotency keys.

## Matrix

Every suite runs for each combination of:

- **Backend**: Commercetools, Medusa — and Magento when
  `E2E_PROTOCOL_MAGENTO=true` (wired up, but not currently expected to pass).
- **Search**: the backend's native product search, Algolia, and Meilisearch.
  The external engines override the `productSearch` capability while carts,
  checkout, products, prices and inventory stay on the backend.

Search-dependent flows (catalog search, pagination, search→cart handoff, ACP
product feeds) run for all search engines. The deep cart/checkout journeys run
once per backend (on the native-search combination) since they are identical
regardless of search engine.

Combinations whose environment variables are missing are skipped, so the suite
degrades gracefully without credentials. Credentials are read from the
workspace root `.env` (see `.env-template` for the variable names).

## Running

```sh
npx vitest run --project node src/protocols
```

The tests hit live services, so they are not part of the offline CI test
target (`examples/*` has no `test:offline` target).

## Order placement

The UCP suite contains one journey that goes all the way to a real order
("places a real order and verifies it through the order capability"): cart with
two items → checkout session with buyer + billing address → shipping method
selection → payment instrument → deferred-payment authorization → complete →
**independent verification through `client.order.getById`** that the order
exists in the backend.

Two steps deserve explanation:

- **Deferred payment**: adding a payment instruction leaves the payment
  `pending`; in production the PSP authorizes it out-of-band (webhook). The
  test plays the PSP's role via `ct-psp-simulator.ts`, which adds a successful
  `Authorization` transaction to the commercetools payment using the admin API
  client (`CTP_ADMIN_CLIENT_ID`/`CTP_ADMIN_CLIENT_SECRET`; the storefront
  client lacks the `view_payments`/`manage_payments` scopes).
- **Shipping selection** goes through the reactionary checkout capability
  directly (joining the protocol session), because the UCP base shopping
  service has no fulfillment routes.

The journey currently runs for commercetools only: medusa gates finalization on
the payment collection being authorized, which only its PSP integrations can
do, so there is no equivalent out-of-band lever yet.

## Locale & currency negotiation

The UCP server accepts a `localization` option mapping buyer signals to a
`languageContext`, mirroring the mapping frontends maintain today:

- the UCP `context.address_country` buyer signal in request payloads (matched
  first — it is the stronger signal per the UCP spec), then
- `Accept-Language` tags (quality-ordered; a `da` rule matches `da-DK`), then
- an optional `fallback`.

The negotiated context is stored in the UCP session and reused for all later
requests of that session, deliberately **not** renegotiated: backends fix a
cart's locale and currency at creation (e.g. commercetools), so drifting the
context mid-session would detach it from the session's carts and checkouts. A
buyer who switches locale effectively starts a new session.

Neither the core store model (`{identifier, name, fulfillmentCenter}`) nor the
providers expose a locale/currency catalogue yet — `LanguageContextSchema` has
a standing TODO about a configured store currency — so the mapping must be
supplied as configuration for now.

## Deliberately out of scope

- **Delegated payment tokens** (ACP `/checkout_sessions/{id}/complete` on an
  active session): requires a live payment service provider issuing the token.
- **UCP identity linking (OAuth)**: requires interactive browser login.

## Known core capability surface limitations (documented, not fixed here)

These were found while building the suites and are limitations of the core /
provider capability surface, not of the UCP/ACP protocol layers:

1. **Commercetools checkout requires a billing address with email at
   initiation.** `CheckoutMutationInitiateCheckoutSchema` declares
   `billingAddress` and `notificationEmail` optional, but the commercetools
   capability only persists the notification email as part of
   `setBillingAddress`, and `CommercetoolsCheckoutFactory.parseCheckout` maps
   `pointOfContact.email` from `billingAddress.email`, which the core
   `CheckoutSchema` validates as a mandatory well-formed email. Consequently
   `initiateCheckoutForCart` without a billing address always fails against
   commercetools (ZodError on `pointOfContact.email`). The UCP e2e checkout
   journey therefore always supplies buyer details and a billing address.
2. **Commercetools inventory lookups need a fulfillment center.**
   `inventory.getBySKU` with an empty fulfillment-center key logs
   `Error fetching inventory by SKU and Fulfillment Center` and the ACP product
   feed reports `availability: "unknown"` for every item. The ACP journey
   accepts `unknown` availability as purchasable for this reason.
3. **UCP checkout cancellation is unmapped.** `POST
   /checkout-sessions/{id}/cancel` returns 501 by design: the core checkout
   capability has no cancellation operation to map it onto.
