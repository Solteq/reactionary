# @reactionary/feeds

Reusable product-feed generation for Reactionary clients.

The package keeps feed generation separate from protocol adapters. A host can provide a ready-made request-scoped Reactionary client and expose the same feed definitions through:

- a mountable fetch-compatible HTTP handler,
- a Node HTTP handler,
- the `reactionary-feeds` CLI,
- direct TypeScript APIs.

## Built-in feed transformers

The default registry includes:

- `acp-product-feed` — ACP Feed API (2026-04-17) `Product` records: `products.jsonl` for file ingestion by default (one product with its variants per line), or with `format: 'json'` the `{ "products": [...] }` body of `PATCH /feeds/{id}/products`. Prices are integer minor units with upper-case currency codes. `toACPFeedMetadata(feedId, feed)` builds the matching `metadata.json`.
- `acp-feed-metadata` — the ACP feed's `metadata.json` (`id`, `target_country`, `updated_at`) for file ingestion next to `products.jsonl`.
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
  --output acp-feed-metadata=./metadata.json \
  --output google-merchant-feed=./google-merchant.xml \
  --output sitemap-feed=./sitemap.xml
```

When running directly from this repository before the package is installed, build the package first and call the built CLI:

```bash
pnpm exec nx run feeds:build
node dist/packages/feeds/cli.js list-feeds --config ./packages/feeds/documentation/basic-product-feeds.config.mjs
```

When `@reactionary/feeds` is installed as a package, npm/pnpm/yarn exposes the `reactionary-feeds` command from the package `bin` entry.

## Publishing ACP feeds to an agent

ACP product feeds (2026-04-17) are **pushed by the merchant to the agent**. The agent (e.g. OpenAI) hosts the Feed API — `POST /feeds`, `GET /feeds/{id}`, `GET`/`PATCH /feeds/{id}/products` — and never calls the merchant for feeds. Your ACP checkout server has no feed endpoints; publishing is a separate job you schedule:

```
your scheduler (cron, Kubernetes CronJob, CI)
  └─ reactionary-feeds publish-acp ── reads the catalogue (Reactionary client)
                                   └─ PATCH {agent Feed API}/feeds/{id}/products ──▶ agent
```

From the agent's onboarding you receive the Feed API base URL, an API key and (usually) a feed id per catalogue. Put them in the feeds config — the key stays in the environment:

```js
// feeds.config.mjs
export default {
  acpFeedApi: {
    baseUrl: 'https://feeds.agent.example/api', // from onboarding
    apiKeyEnv: 'ACP_FEED_API_KEY',              // default; the key itself is never in config
  },
  feeds: {
    finnish: {
      languageContext: { locale: 'fi-FI', currencyCode: 'EUR' },
      search: { term: '', facets: [], filters: ['market:fi'], paginationOptions: { pageNumber: 1, pageSize: 50 } },
      productUrlBase: 'https://shop.example/{lang}/products/{slug}',
      acp: { feedId: 'feed_8f3K2x' },          // from onboarding
    },
  },
};
```

Publish on a schedule. The command prints `{ "feedId", "products", "batches" }` and exits non-zero on any failure, so the scheduler's alerting sees it:

```bash
ACP_FEED_API_KEY=... reactionary-feeds publish-acp -c ./feeds.config.mjs -f finnish
```

```cron
# Every 15 minutes
*/15 * * * * ACP_FEED_API_KEY=... reactionary-feeds publish-acp -c /etc/shop/feeds.config.mjs -f finnish --no-progress
```

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: acp-feed-finnish
spec:
  schedule: "*/15 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: publish
              image: registry.example/shop-feeds:latest
              args: ["publish-acp", "-c", "/config/feeds.config.mjs", "-f", "finnish", "--no-progress"]
              env:
                - name: ACP_FEED_API_KEY
                  valueFrom: { secretKeyRef: { name: acp-feed-api, key: api-key } }
```

Options: `--batch-size <n>` (products per upsert, default 100), `--testMode` (two search pages only) and `--no-progress`.

Notes:

- If the agent does not hand out feed ids, run `reactionary-feeds create-acp-feed -c ./feeds.config.mjs -f finnish` once; it calls `POST /feeds` with the feed's target country and prints the id to put into `acp.feedId`. Nothing is stored at runtime.
- `PATCH` upserts by product id and never removes products. Products that should no longer be sold are reported as unavailable when they are still found; to drop products entirely, publish a full replacement.
- **Full replacement** instead of the API: `reactionary-feeds generate -c ./feeds.config.mjs -f finnish --output acp-product-feed=./products.jsonl --output acp-feed-metadata=./metadata.json`, then upload both files however the agent's onboarding specifies (the ACP spec leaves file transfer to the platform).
- The same publisher is available in code as `ReactionaryACPFeedPublisher` / `createACPFeedPublisherFromConfig` (also re-exported from `@reactionary/acp`).
