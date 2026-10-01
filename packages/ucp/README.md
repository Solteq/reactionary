# @reactionary/ucp

Framework shell for exposing Reactionary through a Universal Commerce Protocol (UCP) HTTP surface.

This package intentionally does **not** implement the UCP action set yet. It establishes the hosting/runtime shape so UCP actions can be added without changing how applications mount the adapter.

## Design goals

- Keep Reactionary core protocol-neutral.
- Accept a Reactionary client factory instead of a singleton client.
- Create a fresh `RequestContext` per request.
- Persist only `RequestContext.session` between requests for the same UCP session.
- Let host applications mount the handler in Next.js, Node, Express, or another HTTP framework.

## Usage

```ts
import { ReactionaryUCPServer } from '@reactionary/ucp';

const ucp = new ReactionaryUCPServer((requestContext) =>
  createReactionaryClient({ contextOverrides: requestContext }),
);

export const POST = (request: Request) => ucp.fetch(request);
export const GET = (request: Request) => ucp.fetch(request);
```

For Node HTTP:

```ts
import { createServer } from 'node:http';
import { ReactionaryUCPServer } from '@reactionary/ucp';

const ucp = new ReactionaryUCPServer(createClient);
const handler = ucp.toNodeHandler();

createServer((request, response) => {
  void handler(request, response);
}).listen(3000);
```

## Session handling

The server uses the `ucp-session-id` header. If the request does not include one, the server creates a new session id and returns it in the response.

Session state is stored through the Reactionary `Cache` interface. The default is `MemoryCache`, which is useful for local development only.

```ts
new ReactionaryUCPServer(createClient, {
  sessionCache: redisCache,
  sessionTtlSeconds: 60 * 60,
});
```

## Current behavior

- `GET` / `HEAD` returns a readiness document.
- `OPTIONS` returns allowed methods.
- `POST` returns `501 UCP_ACTIONS_NOT_IMPLEMENTED`.

The next implementation step is to pin the UCP operation shape and add the default search/cart/checkout actions.
