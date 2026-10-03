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

## Checkout sessions over carts

A reactionary checkout is a frozen snapshot of a finished cart, while UCP and
ACP checkout sessions are mutable and filled in progressively (line items,
buyer, address, shipping choice, payment). Both servers therefore keep the
session as protocol-owned state over a reactionary **cart**:

- **Views** are priced with a *transient* reactionary checkout, created as
  soon as an address is known and discarded again (commercetools replicates
  the cart per checkout, so the copy is deleted; on Medusa/Magento/HCL the
  checkout is the cart itself). Shipping options come from that checkout.
- **Email**: backends need one to quote, so transient checkouts use the buyer's
  email, else the logged-in identity's profile email, else a placeholder
  (`placeholderEmail` option, default `pending@checkout.invalid` — `.invalid`
  is a reserved, undeliverable TLD). The placeholder never reaches the real
  checkout: completion requires a real email.
- **Completion** creates the real checkout, applies shipping and payment, then
  **polls** the checkout until the backend reports it `readyForFinalization`
  (which implies the payment is authorized — on commercetools, adding the
  payment creates a Stripe PaymentIntent and the Stripe webhook records the
  authorization) and finalizes it. The wait is configurable
  (`paymentAuthorizationWait`, default 10s timeout / 1s interval; `0`
  disables it). If it times out, the session answers `complete_in_progress`
  (UCP) / `in_progress` (ACP) and a later complete retries.
- **Session resumption**: agents address sessions by id and rarely echo the
  protocol session header, but backends scope carts to the session's
  (anonymous) identity, so a session id resumes the backend session that
  created it.
- **UCP fulfillment extension** (minimal): destinations and
  `selected_option_id` are read from `fulfillment.methods[]`, and options are
  returned in `fulfillment.methods[].groups[].options[]`.

The inefficiency (one backend checkout initiation per priced view) is accepted
in exchange for keeping the reactionary checkout a frozen point in time.

## Order placement

Both suites contain a journey that goes all the way to a real order and then
**independently verifies it through `client.order.getById`**:

- UCP: cart → session with only a destination (options quoted via the
  placeholder email) → buyer + shipping option → payment instrument → complete
  → `completed`.
- ACP: session from a feed item without buyer → buyer + address (options
  quoted) → option → complete with delegated token → `completed`.

The payment intent is never confirmed by a real buyer in a test, so the Stripe
webhook never fires on its own. `ct-psp-simulator.ts` plays it instead: while
`/complete` is polling, it adds a successful `Authorization` transaction to the
commercetools payment, as the webhook would, using the admin API client
(`CTP_ADMIN_CLIENT_ID`/`CTP_ADMIN_CLIENT_SECRET`; the storefront client lacks
the `view_payments`/`manage_payments` scopes).

These journeys run for commercetools only: medusa gates finalization on the
payment collection being authorized, which only its PSP integrations can do, so
there is no equivalent out-of-band lever yet.

## Locale & currency negotiation

The UCP server accepts a `localization` option mapping buyer signals to a
`languageContext`, mirroring the mapping frontends maintain today:

- the UCP `context.address_country` buyer signal in request payloads (matched
  first — it is the stronger signal per the UCP spec), then
- `Accept-Language` tags (quality-ordered; a `da` rule matches `da-DK`), then
- an optional `fallback`.

`DEFAULT_UCP_LOCALIZATION_RULES` ships a default map (Sweden → SEK, Norway →
NOK, Denmark → DKK, Finland → EUR, English → USD), which these suites use.

The negotiated context is stored in the UCP session and reused for all later
requests of that session, deliberately **not** renegotiated: backends fix a
cart's locale and currency at creation (e.g. commercetools), so drifting the
context mid-session would detach it from the session's carts and checkouts. A
buyer who switches locale effectively starts a new session.

Core has no concept that could carry a locale/currency catalogue: the `Store`
model represents a *physical* store (hence its fulfillment center), not a
webstore or market, and `LanguageContextSchema` has a standing TODO about a
configured project currency. Until a webstore/market concept exists, the
mapping must be supplied as configuration.

## Deliberately out of scope

- **Delegated payment tokens** (ACP `/checkout_sessions/{id}/complete` on an
  active session): requires a live payment service provider issuing the token.
- **UCP identity linking (OAuth)**: requires interactive browser login.

## Known core capability surface limitations (documented, not fixed here)

These were found while building the suites and are limitations of the core /
provider capability surface, not of the UCP/ACP protocol layers:

1. **Checkouts cannot exist without a buyer email** on commercetools and
   Medusa (and Magento guests): their factories emit `pointOfContact.email: ''`,
   which the core `CheckoutSchema` rejects. The protocol layers work around this
   with the placeholder email for transient pricing (see above).
2. **Commercetools inventory lookups need a fulfillment center.**
   `inventory.getBySKU` with an empty fulfillment-center key logs
   `Error fetching inventory by SKU and Fulfillment Center` and the ACP product
   feed reports `availability: "unknown"` for every item. The ACP journey
   accepts `unknown` availability as purchasable for this reason.
3. **Checkout line items are frozen** in reactionary, while protocol sessions
   change them; handled by keeping sessions over carts (see above).
