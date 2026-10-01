# @reactionary/feeds

Reusable product-feed generation for Reactionary clients.

The package keeps feed generation separate from protocol adapters. A host can provide a ready-made request-scoped Reactionary client and expose the same feed definitions through:

- a mountable fetch-compatible HTTP handler,
- a Node HTTP handler,
- the `reactionary-feeds` CLI,
- direct TypeScript APIs.

## Built-in feed transformers

The default registry includes:

- `acp-product-feed` — ACP product feed JSONL by default, with JSON support in protocol adapters.
- `google-merchant-feed` — Google Merchant RSS XML.
- `sitemap-feed` — sitemap XML of product URLs.
- `pricerunner-feed` — PriceRunner-style product XML.

All transformers use the shared normalized feed product model from `ReactionaryFeedGenerator`. XML outputs are generated through XML libraries (`sitemap` for sitemaps and `xmlbuilder2` for RSS/product XML), not by manually concatenating escaped XML strings.

## Default environment client builder

The package exports `createReactionaryFeedClientFactoryFromEnv()` for setups that should use the same environment-variable driven provider selection model as the MCP CLI, without depending on `@reactionary/mcp`.

The helper reads `.env` from the current working directory by default, or `DOTENV_CONFIG_PATH` when explicitly set. It supports the same provider switches and provider variables as the MCP command line package, for example:

```bash
ENABLED_MEDUSA=true
MEDUSA_API_URL=https://medusa.example
MEDUSA_PUBLISHABLE_KEY=pk_test_...
```

CLI config files may omit `createClient`; `reactionary-feeds generate` will then use `createReactionaryFeedClientFactoryFromEnv()` automatically.

The default client builder only enables the provider capabilities needed by feeds and sitemap sources. For full commerce providers this is product search, product details, price, inventory, categories, and stores where supported.

`reactionary-feeds generate` can write one or more outputs in a single source pass by repeating `--output transformer=path`. It writes a progress report to stderr by default, including processed products, pages, elapsed time, and estimated time to completion once the first search result exposes the total product count. Use `--no-progress` to disable it.

Products are normalized concurrently, up to 10 products at a time by default. Set `productConcurrency` in the config or pass `--product-concurrency <count>` to the CLI to tune this.

Use `--testMode` to cap source reads to at most 2 pages while smoke-testing a feed configuration.

You can still provide a project-specific client factory when needed:

```js
import { createReactionaryFeedClientFactoryFromEnv } from '@reactionary/feeds';

export default {
  createClient: createReactionaryFeedClientFactoryFromEnv(),
  feeds: {
    // ...
  },
};
```

## Required Reactionary operations

The generator validates the supplied client before use. The client must expose:

- `productSearch.queryByTerm`
- `product.getBySKU`
- `price.getCustomerPrice`
- `price.getListPrice`
- `inventory.getBySKU`

`price.getCustomerPrice` is used as the effective feed price. `price.getListPrice` is exposed separately where the target feed supports it.

## Feed definitions

```ts
import type { ReactionaryFeedDefinition } from '@reactionary/feeds';

export const finnishFeed: ReactionaryFeedDefinition = {
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
  sellerName: 'Example Shop',
};
```

The `search` value follows Reactionary core’s product-search identifier shape. `languageContext` is applied to the request context before the client is used.

Inventory requests use `fulfillmentCenterKeys` when configured on the feed. If the feed omits them, the generator uses `defaultFulfillmentCenterKeys` from the server or CLI config. The legacy singular `fulfillmentCenterKey` is still supported for existing configs.

```ts
export default {
  defaultFulfillmentCenterKeys: ['helsinki', 'tampere'],
  productConcurrency: 10,
  feeds: {
    finnish: {
      ...finnishFeed,
      fulfillmentCenterKeys: ['turku'],
    },
  },
};
```

`productUrlBase` can either be a normal base URL or a template supporting:

- `{lang}` — the lowercase language part of `languageContext.locale`, e.g. `fi-FI` -> `fi`.
- `{slug}` — the URL-encoded product slug.

## HTTP usage

```ts
import { ReactionaryFeedServer } from '@reactionary/feeds';

const feeds = new ReactionaryFeedServer(createClient, {
  feeds: {
    finnish: finnishFeed,
  },
});

export const GET = (request: Request) => feeds.fetch(request);
```

Routes:

- `GET /feeds` lists configured feed ids.
- `GET /feeds/transformers` lists available transformers.
- `GET /feeds/{feedId}/outputs/{transformerId}` streams generated output.
- `GET /sitemaps.xml` returns a sitemap index when `sitemaps` are configured.
- `GET /sitemaps/{sourceId}.xml` streams a configured sitemap source.

For Node HTTP:

```ts
import { createServer } from 'node:http';
import { ReactionaryFeedServer } from '@reactionary/feeds';

const handler = new ReactionaryFeedServer(createClient, {
  feeds: {
    finnish: finnishFeed,
  },
}).toNodeHandler();

createServer((request, response) => {
  void handler(request, response);
}).listen(3000);
```

## Sitemap sources

Sitemaps use a separate source configuration so product, category, and store URLs can be exposed independently. Use `include` to choose which configured sources should be listed and served.

```ts
new ReactionaryFeedServer(createClient, {
  feeds: {
    finnish: finnishFeed,
  },
  sitemaps: {
    baseUrl: 'https://shop.example',
    include: ['products-fi', 'categories-fi', 'stores-fi'],
    sources: {
      'products-fi': {
        type: 'products',
        feed: 'finnish',
        changefreq: 'daily',
        priority: 0.8,
      },
      'categories-fi': {
        type: 'categories',
        languageContext: {
          locale: 'fi-FI',
          currencyCode: 'EUR',
        },
        urlTemplate: 'https://shop.example/{lang}/categories/{slug}',
        pageSize: 50,
        maxDepth: 10,
      },
      'stores-fi': {
        type: 'stores',
        languageContext: {
          locale: 'fi-FI',
          currencyCode: 'EUR',
        },
        urlTemplate: 'https://shop.example/{lang}/stores/{slug}',
        proximity: {
          longitude: 12.5683,
          latitude: 55.6761,
          distance: 100,
          limit: 100,
        },
      },
    },
  },
});
```

Product sitemap sources reuse an existing product feed definition. Category sitemap sources enumerate top categories and, by default, recursively include child categories through `category.findChildCategories`. Store sitemap sources use `store.queryByProximity`; Reactionary core does not currently expose a provider-neutral “list all stores” operation, so the source requires an explicit proximity query.

Category and store URL templates support `{lang}`, `{slug}`, and `{id}` placeholders.

## CLI usage

The CLI loads an ESM config module that default-exports `{ feeds }` or `{ createClient, feeds }`.
Sample config files are available in [`documentation/`](./documentation/), including a minimal single-feed config and a multilingual da/nb/sv/fi/en config.

```ts
// feeds.config.mjs
export default {
  feeds: {
    finnish: {
      languageContext: {
        locale: 'fi-FI',
        currencyCode: 'EUR',
      },
      search: {
        term: '',
        facets: [],
        filters: [],
        paginationOptions: {
          pageNumber: 1,
          pageSize: 50,
        },
      },
      productUrlBase: 'https://shop.example/{lang}/products/{slug}',
    },
  },
};
```

Commands:

```bash
reactionary-feeds list-feeds --config ./feeds.config.mjs
reactionary-feeds list-transformers --config ./feeds.config.mjs
reactionary-feeds generate \
  --config ./feeds.config.mjs \
  --feed finnish \
  --testMode \
  --output acp-product-feed=./products.jsonl \
  --output google-merchant-feed=./google-merchant.xml \
  --output sitemap-feed=./sitemap.xml
```

When running directly from this repository before the package is installed, build the package first and call the built CLI:

```bash
pnpm exec nx run feeds:build
node dist/packages/feeds/cli.js list-feeds --config ./packages/feeds/documentation/basic-product-feeds.config.mjs
```

When `@reactionary/feeds` is installed as a package, npm/pnpm/yarn exposes the `reactionary-feeds` command from the package `bin` entry.
