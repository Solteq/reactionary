# Tracking customer interactions
Reactionary takes the approach that tracking customer data should be structured and managed, as opposed to ad-hoc in the browser. The core implication of this is that tracking should happen as a centralized, first-party stream of data to the backend, which may then in turn delegate it to the interested parties. We take this approach for a few reasons:

- Performance: the client should not have to load several megabytes of tracking scripts that may in turn bring in other tracking scripts as their first priority upon entering the site. This is treating the customer a product rather than a valued customer. The client should only send their tracking data ONCE, and the performance impact of having to collect it should be a minimal obstruction to their actual goal.
- Control: the system should enforce mandatory requirements such as Do Not Track in a single place, and ensure that anonymization happens as required.
- Structure: it should be possible to reason about what is tracked on the site, how it is tracked and when it is tracked without having to visit seven different tag managers.
- Security: pulling in all the embedded and inline scripts from every tag manager is a security incident waiting to happen.

To this end the client exposes a single capability, `client.analytics`. The storefront calls it and never knows which vendors (Unomi, Algolia, Google Analytics, HCL, ...) receive the events. A single call to record a cart addition is enough, even if the event is delivered to several vendors.

## Emitting events

Every event comes from an explicit call on `client.analytics` by the storefront. Other capabilities (cart, identity, checkout, ...) never emit analytics events on their own.

Each helper is named after its event in camelCase (`cart-item-added` is `cartItemAdded`) and takes a single payload object, like every other capability. `origin` and `properties` are optional on every payload.

```ts
await client.analytics.cartItemAdded({
  cart,                       // the cart after the item was added
  variant: { sku: 'SKU-1' },
  quantity: 1,
  origin: fromPDP(fromSearch(searchIdentifier, 4)),
  properties: { abVariant: 'b' },
});
```

A helper returns `Result<{ eventId }>` as soon as the event is validated and queued. It does not wait for any vendor and it does not throw: invalid input is returned as an error result, and the event is dropped.

| Family | Helpers |
|---|---|
| Browse | `pageViewed`, `searchResultsViewed`, `autocompleteSuggestionSelected`, `categoryViewed`, `productCarouselViewed`, `productClicked`, `productViewed`, `promotionViewed`, `promotionClicked` |
| Cart | `cartItemAdded`, `cartItemRemoved`, `cartItemQuantityChanged`, `cartViewed`, `couponApplied`, `couponRejected` |
| Checkout | `checkoutStarted`, `shippingInfoAdded`, `paymentInfoAdded`, `orderPlaced({ checkout })` |
| Account | `userLoggedIn`, `userLoggedOut`, `userRegistered`, `profileUpdated`, `consentChanged`, `newsletterSubscribed` |
| Engagement | `wishlistItemAdded`, `wishlistItemRemoved`, `backInStockRequested`, `reviewSubmitted`, `storeSelected`, `productShared` |
| B2B | `quoteRequested`, `orderReordered`, `companyRegistered` |
| Escape hatch | `custom({ name, payload })`. Providers ignore names they do not recognise. |

`orderPlaced` takes the finalized checkout, as that is what the customer placed and it exists before the OMS has created the order. Passing `order` still works but is deprecated. Subscribers read it through `summarizePlacedOrder(event.payload)`, which returns the transaction id (the order key when known, else the checkout key), the lines and the price from whichever was given.

Product, category and store arguments accept either the model or its identifier. The storefront does not need to load anything just to describe an event: a `cartItemRemoved` takes the line it rendered (or its sku), and providers look up what they need (names, prices, brands) through a cache-backed, read-only context.

Every payload and sub-model has an exported zod schema (for example `AnalyticsMutationCartItemAddedSchema`, `OriginSchema`, `AnalyticsPromotionSchema`), so a project can `.extend()` them like any other schema.

Refund, shipment and return events are not part of this. They belong to OMS webhooks. There is no browser-side SDK.

### Origins

Where a visitor met a product matters to vendors (Algolia needs the search `queryID`, GA4 wants the item list). Pass an origin built with one of the constructors:

| Constructor | Use for |
|---|---|
| `fromSearch(searchIdentifier, position)` | search results |
| `fromAutocomplete(term, position)` | autocomplete suggestions |
| `fromCategory(categoryId, filters, position)` | category listings |
| `fromList(recommendationId, carouselName, position)` | recommendation and merchandised carousels |
| `fromAssociations(productId, kind, position)` | related, cross-sell, upsell, accessories |
| `fromProductList(listId, position)` | wishlists and saved lists |
| `fromPromotion(promotionId, slot)`, `fromContent(contentId, slot?)` | promotions and content |
| `fromCart(kind?)`, `fromOrder(orderId)`, `fromQuickOrder(kind?)` | cart, reorder, B2B quick order |
| `fromPDP(upstream?)` | the product page, nesting where the visit came from |
| `fromDirect()` | an explicit "unknown" or deep link |

`position` is the absolute 0-based index across pages, not the index within the current page. `fromPDP(fromSearch(id, 4))` keeps conversions made on the product page attributed to the search that led there. Reactionary only accepts the origin; the storefront decides how to carry it between pages (URL parameter, session).

## Delivery

Each built client has its own dispatcher. It is internal to analytics (not a general event bus) and is never shared between requests.

- **Snapshot at emit time.** The event carries the visitor's marketing identifier, identity, locale, currency, consent, referrer, user agent, client IP and bot flag as they were when it was emitted, because delivery happens later and the request and session may have changed by then. The client IP is personal data: it is captured, but each provider decides what to send to its vendor, and the bundled providers do not forward it.
- **The visitor.** The marketing identifier is `requestContext.session.marketingContext.identifier`, the visitor's personalization profile. The helpers take no profile argument; set `session.marketingContext` to the profile the personalization engine resolved before emitting.
- **After the response.** Pass `waitUntil` to the builder so vendor calls finish after the response is sent. Without it delivery is fire-and-forget and errors are logged.
- **Flush.** `await client.analytics.flush()` delivers everything queued and resolves when delivery is done, for scripts, tests and runtimes without `waitUntil`. It never rejects.
- **Isolation.** Each subscriber runs in its own try/catch and its own OpenTelemetry span. One failing vendor never affects another. A subscriber receives events in emit order; different subscribers run in parallel.
- **No loops.** An event emitted from inside a subscriber is logged and dropped.

```ts
import { after } from 'next/server';

const client = new ClientBuilder(requestContext)
  .withCapability(withUnomiCapabilities(unomiConfig, { analytics: { enabled: true } }))
  .withCapability(withAlgoliaCapabilities(algoliaConfig, { analytics: { enabled: true } }))
  .withAnalyticsDispatch({ waitUntil: after })
  .build();
```

Events emitted at different times flush separately. Lookups that providers make are memoized for one flush and otherwise served by the client's shared cache.

## Consent

Every subscriber declares a purpose: `necessary`, `analytics` or `marketing`. The dispatcher skips a subscriber when its purpose is not granted in the consent captured with the event. `necessary` is always allowed.

Consent is read from `requestContext.session.consent` (`{ analytics: boolean, marketing: boolean }`). When the session carries none, the builder's `defaultConsent` applies; if that is not set either, everything is granted, which is how analytics behaved before consent existed. Set `defaultConsent` to opt in rather than out:

```ts
builder.withAnalyticsDispatch({ defaultConsent: { analytics: false, marketing: false } });
```

`consentChanged({ consent })` also updates `session.consent`, so the new consent applies to the event itself and to everything after it in the request. As with the rest of the session, the caller persists it.

The bundled providers use these purposes: Algolia, Google Analytics and HCL are `analytics`; Unomi, which builds visitor profiles, is `marketing`.

## Providers and custom subscribers

A vendor integration extends `AnalyticsProvider`: it declares `name`, `types` (exact event types, prefix wildcards such as `cart-*`, or `*`) and `purpose`, and implements `handle(event, ctx)`. The builder registers the providers returned by capability factories as subscribers.

```ts
class AuditLogProvider extends AnalyticsProvider {
  readonly types = ['order-placed', 'cart-*'] as const;
  readonly purpose = 'necessary' as const;

  async handle(event: AnalyticsEvent, ctx: AnalyticsContext) {
    if (event.type !== 'order-placed') return 'ignored';
    const customer = await ctx.self.profile();   // Result, so degrade instead of failing
    const placed = summarizePlacedOrder(event.payload);   // from the checkout, or the deprecated order
    await writeAudit(event.id, placed?.transactionId, customer.success ? customer.value.email : undefined);
    return 'accepted';
  }
}
```

A subscriber that is not a capability can be added with `withAnalyticsSubscriber({ name, types, purpose, handle })`. Subscriptions are fixed when the client is built; there is no runtime `on()`.

`AnalyticsContext` gives read-only lookups, all through the client's own capabilities so caching applies, and all returning a `Result`: `products.byId/bySku/many`, `categories.byId/path`, `prices.forSku`, `inventory.forSku`, `cart.active`, `orders.byId`, `stores.byId`, and `self.identity/profile/personalization/company` (the current session only). A capability that is not configured answers with an error result. Providers should send fewer fields when a lookup fails, not drop the event. Handlers get the context, never the client, so there is no way to mutate anything from analytics.

## Testing

`RecordingAnalyticsSubscriber` records what it receives:

```ts
const recorder = new RecordingAnalyticsSubscriber();
const client = new ClientBuilder(context).withAnalyticsSubscriber(recorder).build();

await client.analytics.productViewed({ product: { key: 'p1' } });
await client.analytics.flush();

expect(recorder.eventsOfType('product-viewed')).toHaveLength(1);
```

## Migrating

### From `client.analytics.track`

`track(event: AnalyticsMutation)` still works but is deprecated. It converts the event to its new equivalent and queues it like the helpers do.

| Legacy | New |
|---|---|
| `product-summary-view` with a search source | `searchResultsViewed` |
| `product-summary-view` without a source | `productCarouselViewed` with carousel name `unknown` |
| `product-summary-click` | `productClicked` with `fromSearch(identifier, position)` or `fromDirect()` |
| `product-details-view` | `productViewed` |
| `product-cart-add` | `cartItemAdded`. The legacy event has no cart, so the active cart and the product's main variant are looked up |
| `purchase` | `orderPlaced`, with the legacy event's `order` (deprecated in favour of `checkout`) |

Compatibility is at the API level only. `track` still returns an `AnalyticsResult`, but it holds one `accepted` outcome for the analytics capability (or `rejected` when the event could not be queued); the outcomes no longer reflect what each provider did, because nothing waits for providers. A `personalizationProfile` on the legacy event identifies the visitor for that event only, as before. Prefer setting `session.marketingContext` and using the helpers.

`track` used to wait for the vendor calls; it now returns once the event is queued. In a runtime that freezes after the response (serverless), delivery has to be kept alive, or the vendor call can be cut off:

```ts
// Next.js: keep delivery alive after the response
after(async () => {
  const client = await createClient();
  await client.analytics.track({ event: 'product-summary-view', products, source });
  await client.analytics.flush();   // or build the client with .withAnalyticsDispatch({ waitUntil: after })
});
```

### What changes without touching your code

- `client.analytics` is no longer exposed to MCP clients as tools. It is storefront telemetry, and every client has the capability whether or not a provider is enabled.
- Algolia sends the plain `click`, `addToCart` and `purchase` events when an event has no search `queryID`, and the `...AfterSearch` events when it has. Click positions are sent 1-based (origins are 0-based), so a caller that already passed 1-based positions to the old `product-summary-click` will be one off.
- Google Analytics sends `user_id` as a hash of the user id for registered visitors only, where it used to send the marketing id. Add-to-cart events carry price, quantity and currency.
- Unomi ignores events without a marketing identifier, and is skipped when marketing consent is not granted.
- Events are delivered with the identity, locale, currency and consent captured when they were emitted, not those at delivery time.

### From `AnalyticsCapability` subclasses

`AnalyticsCapability` is now the storefront-facing capability. The provider base class is `AnalyticsProvider`, and the `process*` hooks and `MulticastAnalyticsCapability` are gone. A provider that overrode `processProductSummaryView` and friends now implements `handle` and switches on `event.type`. Provider factory overrides (`analytics: { enabled, capability }`) now return an `AnalyticsProvider`. `ClientCapabilities` is the type capability factories return: it is `Partial<Client>` with `analytics` typed as an `AnalyticsProvider`.
