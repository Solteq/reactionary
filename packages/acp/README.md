# @reactionary/acp

Framework shell for exposing Reactionary through an Agentic Commerce Protocol (ACP) HTTP surface.

This package intentionally does **not** implement the ACP action set yet. It establishes the hosting/runtime shape so ACP actions can be added without changing how applications mount the adapter.

## Design goals

- Keep Reactionary core protocol-neutral.
- Accept a Reactionary client factory instead of a singleton client.
- Create a fresh `RequestContext` per request.
- Persist only `RequestContext.session` between requests for the same ACP session.
- Let host applications mount the handler in Next.js, Node, Express, or another HTTP framework.

## Usage

```ts
import { ReactionaryACPServer } from '@reactionary/acp';

const acp = new ReactionaryACPServer((requestContext) =>
  createReactionaryClient({ contextOverrides: requestContext }),
);

export const POST = (request: Request) => acp.fetch(request);
export const GET = (request: Request) => acp.fetch(request);
```

For Node HTTP:

```ts
import { createServer } from 'node:http';
import { ReactionaryACPServer } from '@reactionary/acp';

const acp = new ReactionaryACPServer(createClient);
const handler = acp.toNodeHandler();

createServer((request, response) => {
  void handler(request, response);
}).listen(3000);
```

## Session handling

The server uses the `acp-session-id` header. If the request does not include one, the server creates a new session id and returns it in the response.

Session state is stored through the Reactionary `Cache` interface. The default is `MemoryCache`, which is useful for local development only.

```ts
new ReactionaryACPServer(createClient, {
  sessionCache: redisCache,
  sessionTtlSeconds: 60 * 60,
});
```

## Current behavior

- `GET` / `HEAD` returns a readiness document.
- `OPTIONS` returns allowed methods.
- `POST` returns `501 ACP_ACTIONS_NOT_IMPLEMENTED`.

The next implementation step is to pin the ACP operation shape and add the default search/cart/checkout actions.
