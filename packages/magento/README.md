# magento

Reactionary provider for Magento 2 / Adobe Commerce. It uses the REST API, plus GraphQL where Magento has no REST equivalent (reviews, wishlists, requisition lists, pickup locations, customer segments, B2B company).

## Capabilities

Enable them with `withMagentoCapabilities(configuration, { <key>: { enabled: true } })`. Every capability except `identity` and `productRecommendations` also takes a custom `factory` and/or `capability`.

| Key | Notes |
| --- | --- |
| `product`, `productSearch`, `category` | Catalog. |
| `price`, `inventory` | Inventory uses MSI source items, with a fallback to the legacy stock item. |
| `cart`, `checkout` | Guest and customer quotes. |
| `order`, `orderSearch` | Guests can read the orders their own session placed, which covers the order confirmation page. |
| `identity`, `profile` | Customer accounts and address book. |
| `productAssociations`, `productRecommendations`, `productReviews` | Related, up-sell and cross-sell links. Reviews go through GraphQL. |
| `productList` | Wishlists. Requisition lists need Adobe Commerce B2B. |
| `store` | MSI in-store pickup locations. |
| `personalizationProfile` | The customer group, plus customer segments when enabled. |
| `company`, `companyRegistration`, `employee`, `employeeInvitation` | B2B. Need Adobe Commerce with the B2B modules, and Company enabled. |

Some features need Adobe Commerce 2.4.7 or later, for example customer segments (`personalizationIncludeSegments`).

## Configuration

`schema/configuration.schema.ts` is the authoritative list. These optional fields are new:

- `addressNicknameAttribute`: the customer-address custom attribute that holds the address nickname. If it is not set, the nickname is stored in the address `company` field.
- `checkoutTelephoneFallback`: the telephone sent when the shopper gave none. Default: `'000'`. Set it to `''` to send none.
- `storeLocationsCacheTtlSeconds`: how long the pickup location list is cached. Default: 300.
- `personalizationResolveGroupCodes`: resolves customer group codes through the admin API. Default: false.
- `personalizationIncludeSegments`: includes Adobe Commerce customer segments (2.4.7+). Default: false.
- `companyRoleMapping`: `{ manager?, employee? }`. Maps the core employee roles to Magento company roles, by uid or name.
- `companyUserDefaults`: `{ firstName?, lastName?, jobTitle?, telephone? }`. Placeholders for the fields `createCompanyUser` requires.

## Admin integration token

`adminApiKey` must be an integration token that has at least these resources:

- `Magento_Catalog::sets`: attribute sets and attribute metadata.
- `Magento_Sales::actions_view` (Sales > Orders > View): order lookup and order search through `/V1/orders`.
- `Magento_Company::index`: B2B company lookups. Only needed for the B2B capabilities.

## Not supported

- Shopping list as a list type. List image and publish date, wishlist description, per-item order, requisition item notes and the requisition "published" flag.
- Store opening hours.
- Catalog price rules over REST.
- Popular, top picks and also-viewed recommendations, and labels or personalization in recommendations. "Trending" maps to "newest". The category filter matches direct assignment only, not anchor categories.
- Company-wide order search, and `search.filters` on order search.
- Product search: sorting, company or personalization context, child-to-parent lookup, website scope, final-price filters and multiselect `finset` filters. Facet counts can drift.
- B2B: company shipping address CRUD, which needs SaaS and the `X-Adobe-Company` header. Also listing and revoking invitations. `listCompanies` returns only the current company.

## Building

Run `nx build magento` to build the library.

## Running unit tests

Run `nx test magento` to execute the unit tests via [Vitest](https://vitest.dev/).
