# Reactionary

Reactionary is a framework-agnostic client library for standardized data access, building upon the previous learnings from Perpendicular. It is decidedly opinionated. Compared to Perpendicular it:

- it favors keeping the providers on the server in order to:
  - keep the client bundle minimal for performance.
  - allow for cross transactional caching.
  - standardize observability.
  - control access, allowing for session features like rate limiting.
- it favors serializable, parseable domain models because it:
  - allows for caching and state transfer.
  - allows for extensible, typesafe data at runtime.

## Contributing

### Running locally

The includes examples generally require `.env` to be configured with the relevant API keys. We can likely create a setup for this in Vault, for easy bootstrapping.

### Pull requests

For new features, branch from `main` and create a pull request towards `main` upon feature completion. Please observe the following guidelines:

- Preserve a linear history. This means rebasing on `main`, rather than merging. PR's containing merge commits should be considered unmergeable.
- Observe [https://www.conventionalcommits.org/en/v1.0.0/#summary][conventional commit message guidelines] for the rebased pull request commits.
- Ensure that the PR is linked to an issue.

## Glossary

The following is a short list of commonly used terms and phrases, to keep guessing to a minimum.

- *Provider:* a backend service providing an API that can be consumed. HCL or Commercetools would be examples of ecom providers, while Algolia would be an example of a search provider.
- *Capability:* a capability (or more fully, a business capability) is a discrete area of functionality that may be provided to the consuming party. An example would be *Cart*, providing a domain model and a set of discrete operations that can be performed on it, like adding a product or removing a product.
- *Gateway:* a serverside process encapsulating a set of capabilities. This could be a trpc router, or it could be react server. The purpose here is to ensure that all of the dependencies and environmental configuration stays on the server, rather than the client.
- *Client:* the client facade to the gateway. In trpc this is would be the trpc client. It can be bundled into client-side rendering code.
- *Observability:* means of providing insights into the workings of the system, in a production context. This is distinct from analytics in that it provides information on the workings of the *system* rather than the workings of the *user*. OTEL (opentelemetry) provides a standardized specification for this in the form of *traces* and *metrics*.
- *Fake:* an implementation that provides a functional response, but with in a limited capacity. A fake provider may, for example, provide *Cart* functionality, but only store it in-memory and throw it away on a whim. As such it can be used for prototyping, but never for a production scenario.
- *Product Analytics:* structured analytics that relate to how the the product is being used.
- *Microsite:* an application of a limited scope. It may focus solely on this limited functionality, making it ideal for demonstration purposes.



## TODO:


### Roadmap to V0.1
Usecase: As a shopper i search for products, add to cart and check out.
Vendors: Commercetools, Algolia, Medusa

UX Pages and components supported:
- PDP
  - Product info
  - Attribute table
  - Variant selection
  - Inventory display
  - Price display (simple pricing)
- PLP - Keyword Search + Facet
- Minicart
- Cart Page
- Checkout - Address 
- Checkout - Shipping
- Checkout - Payment
- Checkout - Confirmation
- Account - Sign up (email, password)
- Account - Log in (email, password)

#### Tasks:
- [ ] Cart - Remove checkout related functions - AKJ
- [X] Checkout - Receive full cart in input - MR
- [ ] Inventory - Model to use ProductVariantIdentifier instead of SKU - AKJ
- [ ] Price - Add Usage/Pricelist modifier for Queries to allow for List/Offer price. - MR
- [X] Commercetools - Guest sesion race condition - MR
- [X] Commercetools - Seperate temporary admin client from `Me` based client. - MR
- [ ] Medusa - Identity capability - AKJ
- [X] Medusa - Price capability - AKJ
- [X] Medusa - Category capability - AKJ
- [X] Medusa - Inventory capability - AKJ
- [ ] Medusa - Store capability - AKJ
- [X] Search Index Model Add information about number of variants on the main model (or directly if it can be added to cart or not) - AKJ
- [X] CLI for importing icecat to all vendors - AKJ
- [X] Unified Data Set for Products - AKJ
- [X] Unified Data Set for Inventory - AKJ
- [X] Unified Data Set for Prices - AKJ
- [ ] Unified test set for all vendors - AKJ
- [ ] Medusa - test of Client - AKJ
- [-] Reactionary Decorator on all public Query and Mutation methods - MR
- [X] Input validation via Zod.parse for all public Query and Mutation methods - MR
- [X] Output validation via Zod.parse for all public Query and Mutation methods - MR
- [X] Change Zod schema from looseObjects to .passthrough - MR
- [X] Minor fixes from Angular Frontend - MR



### Roadmap to V0.2
Usecase: as a shopper i use the site navigation to find products, add to cart and checkout
Vendors: Commercetools, Algolia, Medusa

- Menu navigation
- CLP - Category Navigation  
- Revise and review Schema usage patterns to reduce number of irrelevant default values.
- Move to Errors as Values on base api, no null, no undefineds, no exceptions out of Reactionary

### Roadmap to V0.3
Usecase: As a registered user, i access my-account
Vendors: Commercetools, Algolia, Medusa

- Profile - Address book
- Orderhistory - List and Details
- Consents - marketing, newsletters etc


### Roadmap to V0.4
Usecase: As a seller i want to seed my recommendation and analytics with customer actions  (Analytics)
Vendors:  Algolia, Google Analytics

- PLP
  - Attribution Tracking
  - Facet Tracking
- PDP
  - Attribution Tracking
- Checkout
  - Conversion Tracking


### Roadmap to V0.5
Usecase: As a merchandiser i want to upsell
Vendors: Algolia,  Commercetools

- PDP
  - Recommendations (Products, Categories)
  - Associations (Spareparts, Accessories)
  - Ratings and Reviews
- Checkout
  - Recommendations (Products)


### Roadmap to V0.6
Usecase: As a shopper i want to create shoppinglist/wishlist
Vendors:  Commercetools, Medusa

- Account - Shopping List, Listing and Details
- PDP
  - Add to Shopping List
- PLP
  - Add to Shopping List


### Roadmap to V0.7
Usecase: As a B2B user i want to shop using my own prices
Vendors:  Commercetools

- PDP / PLP
  - External Pricing
  - Organizational/Entitlement Context
  - Multi currency/Multi lingual


### Roadmap to V0.8
Usecase: As a B2B user i want to see my organization data
Vendors:  Commercetools

- Account - My Organization(s) 
- Account - Self management of users and roles


### Roadmap to V0.9
Usecase: As a B2B user i want have multiple carts and requisition lists
Vendors:  Commercetools

- Account - My Open Carts

### Roadmap to V1.0
Usecase: As a B2B user i want to see other peoples carts and orders
Vendors:  Commercetools

- Account - Organizational Order History









### Roadmap V0.x
- Additional vendors
  - AthosCommerce (Klevu)
  - ShopifyPlus
  - HCL Commerce
  - Adobe Commerce
  - Lipscore
- PDP
  - Price display (tiered pricing, variant differential pricing)






## Adding a new provider
So, you want to add to the fun, and add a new provider.
A new provider can be as partial or as complete as you need it to be, but each capability it undertakes, must be fully supported.

## Step 0
Make sure you have a clean test environment. Ie not some half-baked instance with broken test data. Ideally, you are able to spin up and preconfigure instances via scripts.

## Step 1
Populate your environment with the shared test-data set. Reactionarys providers all share a set of product information based on ICECAT. 

If you are internal to Solteq, you can work off of https://github.com/Solteq/composable-commerce-base-workspace. If you are external, go to ICECAT.biz, and register an account.
Then use their API to download the free dataset and all the various product-data files. Parse those, and import them in your system as appropriate.

Consider, that you may not need to import all of it, if your capability doesn't need it. Ie if you are only implementing the CART capability, you don't really need the product images, or long descriptions.

## Step 2
Add your provider library here.

```
npx nx g lib providers/<vendor> --buildable --publishable TODO: Martin, fill in
```

Within each `src` folder, adhere to the naming convention of the existing providers:
- `core` (capabilities and initalization)
- `providers` (each capability in its own file, named for itself )
- `schema` any vendor specific schema overrides
- `test` any internal/specific test to that provider.

## Step 3
Create the initialization and capabilities schema, and start adding logic.

## Step 4 
As your new vendor lib contains the same test data that all other vendors do, you can run the `global-tests` suite. This will show if your capability implementation adheres to the expected behavior within reactionary.
