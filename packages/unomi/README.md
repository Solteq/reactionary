# unomi

Apache Unomi as the CDP of Reactionary: it receives the behavioural events of the storefront and hands the personalization profile back.

## Building and testing

Run `nx build unomi` to build the library and `nx test unomi` to run the unit tests via [Vitest](https://vitest.dev/).

## The event contract

One reactionary analytics event becomes one Unomi event. The events, their shared `product`, `line`, `order` and other items, and every field are
defined in `src/contract` as Zod schemas, and the same definitions are used to check each event before it is sent. Unomi drops an event that does
not match its JSON schema without a word, so an event that breaks the contract is left out with a warning (the fields at fault, never their values).

The JSON schemas of the contract are generated, not written by hand:

```bash
npx --package @reactionary/unomi reactionary-unomi-schemas --out base --examples examples/reactionary --reactionary-version <version>
```

It writes `items/` and `events/` as Unomi JSON schemas (draft 2019-09, `unevaluatedProperties: false`), a manifest, and one valid example event per event type.
The Solteq `exceptional-insights-cli` repository keeps them under `base/` and deploys them to Unomi; `SPEC.md` there is the specification.

### What is sent

| Reactionary event | Unomi event | Target |
|---|---|---|
| `page-viewed` | `view` (built in) | page |
| `product-viewed`, `product-clicked`, `wishlist-item-added`, `back-in-stock-requested`, `review-submitted`, `product-shared` | `productViewed`, `productClicked`, `wishlistItemAdded`, `backInStockRequested`, `reviewSubmitted`, `productShared` | product |
| `category-viewed` | `categoryViewed` | category |
| `content-viewed` | `contentViewed` | content |
| `promotion-clicked` | `promotionClicked` | promotion |
| `cart-item-added`, `cart-item-removed` | `cartItemAdded`, `cartItemRemoved` | line |
| `coupon-applied`, `checkout-started`, `quote-requested` | `couponApplied`, `checkoutStarted`, `quoteRequested` | cart |
| `order-placed`, `order-reordered` | `orderPlaced`, `orderReordered` | order |
| `store-selected` | `storeSelected` | store |
| `experiment-exposed` | `experimentExposed` | experiment (`exp.<key>.<version>`) |
| `trait-declared` | `traitDeclared` | trait (`<trait>.<value>`) |
| `newsletter-subscribed`, `user-registered`, `company-registered` | `newsletterSubscribed`, `userRegistered`, `companyRegistered` | none |
| `user-logged-in` | `login` (built in) | none, `properties.userId` is a SHA-256 of the user id |

Not sent: impressions (search results, carousels, promotion views, autocomplete), quantity changes, cart views, shipping and payment steps, rejected
coupons, logouts, profile updates, consent changes and custom events. Bots are left out, and so is any event of a visitor without a marketing
profile.

What the events carry beyond what the storefront passes is looked up through the analytics context: product name, brand, product type, categories
(with all their parents, from the root down), taxonomy concepts, prices, stores. A lookup that fails sends fewer fields, not no event.

- **Item ids.** Unomi accepts an `itemId` of letters, digits and `-_@.`, at most 60 characters. Any other key (a slash, too long) is replaced by
  `h-` and 40 hex characters of its SHA-256. The same key always gets the same id; the readable key is in `name`.
- **Money.** Amounts come in the currency of the request and in EUR. The rate is the ECB euro reference rate of the latest day, cached for a day, and
  is sent on the event as `fxRate` and `fxDate`. When the ECB rates cannot be had, `fxFallbackRates` applies; a currency with neither gets no EUR amounts.
- **Shipping area.** An order carries the shipping country and, for a country that has a configured cut (`shippingPostalAreaDigits`, default DK 4, NO 4, SE 3, FI 3), the postal code cut to an area. A country without one sends the country only. Never the street.
- **Origin.** Where the visitor came from is sent flat (search term, active facet filters, category, carousel, promotion, ...), without positions.
- **Coupons.** The checkout does not carry the coupon codes, so `orderPlaced.couponCodes` is always empty. `couponApplied` has the code.

## Authentication (Unomi 4)

The sender must be a **trusted caller**: set `username` to the tenant id and `password` to the tenant private key (the system administrator also
works), and use HTTPS. Unomi then accepts the profile id the sender passes, and lets the login rule merge profiles. A public key (`apiKey`) is sent as
`X-Unomi-Api-Key`, but it is not trusted: Unomi ignores the profile id and refuses merges, so events would land on a throwaway profile per request.

`peerKey` is sent as `X-Unomi-Peer`. Only Unomi in single-tenant compatibility mode (and Unomi 3) looks at it, together with the source address.

## Interests and segments

Reactionary reads the segments of a profile and turns the ones named `affinity.<vocabulary>.<slug>.<low|medium|high>` into
`PersonalizationProfile.affinities` (concept id to a weight: low 0.3, medium 0.6, high 1.0). The segments and the scoring plans behind them are
generated from the taxonomy of the project by `exceptional-insights-cli`; the events carry the concept ids of the product or content, so nothing
separate is sent for interest. `client.taxonomy.expandAffinities` and `rankByConcepts` use the result.

## Configuration

`apiUrl` is required, the rest has a default or can be left out:

| key | default | |
|---|---|---|
| `username`, `password` | none | Tenant id and private key: a trusted caller. |
| `apiKey` | none | A tenant public key. Not trusted. |
| `peerKey` | none | Sent as `X-Unomi-Peer`. |
| `scope` | `default` | The Unomi scope, one per storefront. |
| `sourceId` | `reactionary` | The `itemId` of the `site` that is the source of the events. |
| `fxRatesUrl` | the ECB daily rates | Empty turns the fetch off. |
| `fxFallbackRates` | `{ DKK: 0.134 }` | EUR per unit of a currency, when the ECB rates are not available. |
| `shippingPostalAreaDigits` | `{ DK: 4, NO: 4, SE: 3, FI: 3 }` | Characters of the postal code sent per country. Not listed: no postal area. |

`withUnomiCapabilities` and the constructor of the analytics provider take the configuration with the keys that have a default left out, the defaults are applied for them.
