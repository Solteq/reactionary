# unomi

Apache Unomi as the CDP of Reactionary: it receives the behavioural events of the storefront and hands the personalization profile back.

## Building and testing

Run `nx build unomi` to build the library and `nx test unomi` to run the unit tests via [Vitest](https://vitest.dev/).

## Concept interest

This section is for the person who configures Unomi. Reactionary records what a visitor is interested in as interest in taxonomy concepts (for example `features/cordless`), and reads the result back as segments. Unomi 3 cannot look up item data for an event, so the concept ids travel in the events, one small event per concept. The storefront knows nothing about Unomi, it only uses `client.analytics`.

### The event

After the usual Unomi event of a product view, product click, add to cart, order or content view, Reactionary adds one event per concept, in the same request:

```json
{
  "eventType": "concept_interest",
  "scope": "<the configured scope>",
  "target": { "itemId": "features/cordless", "itemType": "concept" },
  "properties": {
    "source": "product_view",
    "vocabulary": "features",
    "productId": "p1"
  }
}
```

- `target.itemId` is the concept id, `<vocabulary>/<slug>`. Ids and vocabularies are lowercase letters, digits, `_` and `-`.
- `properties.vocabulary` is the vocabulary of the concept.
- `properties.source` says what the visitor did:

| source | Reactionary event | Extra properties |
|---|---|---|
| `product_view` | a product detail view | `productId` |
| `product_click` | a click on a product | `productId` |
| `add_to_cart` | an item added to the cart | `productId` |
| `purchase` | an order was placed | `orderId` |
| `content_view` | a CMS article or page was viewed | `contentId`, `contentType` when known |

- Only the most specific concepts of a product are sent, the ones assigned to it. Their broader concepts (the parents) are not sent, nor are narrower or related ones. Reactionary expands them when it reads the interest, so Unomi only has to count what it receives.
- Impressions (search results, carousels) are not interest and send no `concept_interest`.
- An event with no concepts, or a product that cannot be resolved, sends the usual events and no `concept_interest`.
- At most `maxConceptsPerEvent` concepts are sent per event (default 5, the most specific first), and `maxConceptsPerOrder` (default 10) for a whole order.

### What to set up in Unomi

1. **A rule per event** that adds to a counter of the profile per concept, for example a property `concepts.<vocabulary>.<slug>` incremented from every `concept_interest` event. Weight the increment by `properties.source`. A suggested order, the numbers are for the Unomi owner to decide: `product_view` < `product_click` < `add_to_cart` < `purchase`, and `content_view` comparable to `product_view`.
2. **Segments for the bands.** The thresholds live in Unomi only, Reactionary never sees a raw score. Create segments named

   ```
   affinity.<vocabulary>.<slug>.<low|medium|high>
   ```

   for the concepts that matter, for example `affinity.features.cordless.high` means a high interest in `features/cordless`. The vocabulary and the slug never contain a dot, so the name is split on the dots and must have exactly four parts and a lowercase band. A segment that does not follow this is some other segment and is ignored. If several bands of one concept are set, the highest counts.
3. **Consent** is handled in Unomi. The analytics provider declares the purpose `marketing`, Reactionary only sends events for visitors whose consent allows it, and the profile and its counters are governed by your Unomi consent and retention setup.

Reactionary reads the segments from the profile (`PersonalizationProfile.segments`) and turns the `affinity.*` ones into `PersonalizationProfile.affinities`, concept id to a weight (low 0.3, medium 0.6, high 1.0). `client.taxonomy.expandAffinities` and `rankByConcepts` use them to boost content on concepts the visitor cares about.

### Configuration

All keys are optional:

| key | default | |
|---|---|---|
| `conceptInterest` | `true` | Turns the `concept_interest` events off. |
| `conceptInterestVocabularies` | all | Only concepts of these vocabularies are sent. |
| `maxConceptsPerEvent` | `5` | The most concepts for one product or content event. |
| `maxConceptsPerOrder` | `10` | The most concepts for one order, in total over its lines. |
| `encodeConceptIdSlash` | `false` | Sends `/` as `__` in `target.itemId` (`features__cordless`), for a Unomi that does not accept a slash in an id. The concept id stays `vocabulary/slug` everywhere else in Reactionary. The segment names always use the dotted form. |

The slash and the `__`: a concept id is `vocabulary/slug`. When your Unomi setup cannot store a `/` in an item id, switch `encodeConceptIdSlash` on and expect `features__cordless` in `target.itemId`. Everything else (the `vocabulary` property, the segments) is unaffected.
