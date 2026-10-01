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

All transformers use the shared normalized feed product model from `ReactionaryFeedGenerator`.

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
};
```

The `search` value follows Reactionary core’s product-search identifier shape. `languageContext` is applied to the request context before the client is used.

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

## CLI usage

The CLI loads an ESM config module that default-exports `{ createClient, feeds }`.

```ts
// feeds.config.mjs
export default {
  createClient(requestContext) {
    return createReactionaryClient({ contextOverrides: requestContext });
  },
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
reactionary-feeds generate --config ./feeds.config.mjs --feed finnish --transformer sitemap-feed --output ./sitemap.xml
```
