# @reactionary/mcp

`@reactionary/mcp` exposes an instantiated Reactionary client surface as a Model Context Protocol (MCP) HTTP service.

The package is intentionally thin:

- Reactionary remains the commerce abstraction layer.
- Host applications own routing, deployment, authentication, policy, and persistence choices.
- MCP tools are generated from existing Reactionary capability metadata instead of being hand-written one by one.
- The same runtime can be mounted from frameworks such as Next.js, Express, or plain Node HTTP.

## Design goals

The adapter exists to make Reactionary usable by agents without turning Reactionary into a hosted platform or router.

The important boundary is:

- **Reactionary packages** provide typed commerce capabilities.
- **`@reactionary/mcp`** converts those capabilities into MCP tools, resources, and prompts.
- **The host app** decides where `/mcp` lives, how users authenticate, how sessions are stored, and which capabilities are enabled.

This package therefore exports `ReactionaryMCPServer` instead of adding a built-in `/mcp` route to Reactionary itself.

## Core API

```ts
import { ReactionaryMCPServer } from '@reactionary/mcp';
import { createReactionaryClient } from './my-reactionary-client';

const mcp = new ReactionaryMCPServer((requestContext) =>
  createReactionaryClient({
    context: requestContext,
  }),
);

export async function POST(request: Request) {
  return mcp.fetch(request);
}
```

`ReactionaryMCPServer` takes a **client factory**, not a singleton client:

```ts
type ReactionaryMCPClientFactory = (
  requestContext: RequestContext,
) => ReactionaryMCPClient;
```

The factory is called for each MCP serving unit with a fresh `RequestContext`. This matters because Reactionary capabilities hold a mutable request context. Identity, cart, checkout, personalization, and provider-specific session data can change during tool calls.

Passing a singleton client would let one MCP user/session inherit another user's identity or cart state, so the public runtime is designed around per-request/per-session client construction.

## MCP server wrapper

Internally, the package uses:

- `@modelcontextprotocol/server`
  - `createMcpHandler(...)`
  - `McpServer`
  - `fromJsonSchema(...)`
- `@modelcontextprotocol/node`
  - `toNodeHandler(...)`

`ReactionaryMCPServer` exposes both Web-standard and Node-style integration:

```ts
const mcp = new ReactionaryMCPServer(createClient);

// Web-standard runtimes: Next.js route handlers, Fetch API servers, Workers-like runtimes
await mcp.fetch(request);

// Node HTTP / Express-style integration
const nodeHandler = mcp.toNodeHandler();
```

The core package does not depend on Express.

## Tool discovery

MCP tools are discovered from Reactionary capability methods decorated with `@Reactionary(...)`.

The metadata comes from core capability runtime discovery:

- capability resource name
- method name
- input Zod schema
- output Zod schema
- title
- description

Default tool names are:

```txt
<capabilityName>.<methodName>
```

Examples:

```txt
product.getBySKU
productSearch.queryByTerm
price.getListPrice
inventory.getBySKU
cart.addItem
checkout.startCheckout
```

Tool names can be customized with the `toolName` option:

```ts
const mcp = new ReactionaryMCPServer(createClient, {
  toolName: (capabilityName, methodName) =>
    `reactionary.${capabilityName}.${methodName}`,
});
```

## Schema conversion and defaults

Reactionary schemas are Zod schemas. MCP expects JSON-Schema-like tool contracts. `@reactionary/mcp` converts schemas with:

```ts
z.toJSONSchema(schema, { io: 'input' })
fromJsonSchema(...)
```

There are two important details:

1. **Descriptions are preserved**

   Zod `.meta({ description })` and compatible descriptions become MCP field descriptions through Zod JSON Schema conversion.

2. **Defaults are handled defensively**

   Some legacy schemas used default factories such as:

   ```ts
   SomeSchema.default(() => SomeSchema.parse({}))
   ```

   That is unsafe when `SomeSchema.parse({})` is invalid. Zod JSON Schema generation can evaluate those default factories, which can crash tool discovery.

   The MCP adapter now prepares schemas before conversion:

   - safe defaults are preserved and shown to MCP clients
   - unsafe defaults are omitted from the MCP schema
   - fields with unsafe defaults are published as required: a default that fails when it is evaluated fails every call that leaves the field out, so the field cannot be omitted, whatever its type says
   - descriptions/metadata are copied when schemas are rebuilt for JSON Schema generation

### Monetary and cost default note

Core monetary amounts remain strict: a raw money object must include both `value` and `currency`. Empty provider data such as `{}` should fail output validation rather than silently becoming a real price.

Some aggregate cart/checkout cost-breakdown fields still use a temporary placeholder default:

```json
{ "value": 0, "currency": "EUR" }
```

That fallback is intentionally placed on the parent cost-breakdown fields, not on `MonetaryAmountSchema` itself. It should eventually be replaced by configured/request-context currency handling or explicit "unknown monetary amount" modeling.

## Tool descriptions

An agent chooses and calls a tool from its name, its description and its input schema, so the description is what makes `cart.add` different from `cart.changeQuantity` for it.

- A description set on the method with `@Reactionary({ description })` is used as it is.
- Otherwise `src/lib/tool-descriptions.ts` has one for each operation of the core capabilities, by `<capability name>.<method name>`. They are written for agents, not copied from the code documentation, and say what the operation is for, which tool its input comes from, and the details of the input that the schema cannot say: which fields have to be sent although they are empty, what an empty result means.
- An operation that has neither is published without a description.

`src/lib/tool-surface.spec.ts` looks at every operation of the providers, and fails when an operation has no description or declares no input schema, when a description is left for an operation that does not exist, or when a description has notes to the developers of the library in it. Add the description in `tool-descriptions.ts` when you add an operation.

A method that declares no `inputSchema` gets the default one, which accepts anything. Such a tool is published as an object with any properties, its arguments are passed to the method, and a warning names it once. Declare the input schema on the method to describe what it takes.

## Tool result envelope

Successful MCP tool calls return structured content in a consistent envelope:

```json
{
  "value": {}
}
```

Void-returning capabilities use:

```json
{
  "value": null
}
```

This keeps successful `undefined`, scalar, array, and object results protocol-valid and aligned with the advertised MCP output schema.

## MCP session handling

Each MCP session must preserve the Reactionary `RequestContext.session` across requests.

`ReactionaryMCPServer` handles this by:

1. Reading the `mcp-session-id` request header.
2. Creating a new session id when the request has none.
3. Creating a fresh `RequestContext`.
4. Restoring the cached `.session` into that context when a previous session exists.
5. Building a fresh Reactionary client with that context.
6. Persisting `requestContext.session` back to cache after each tool call.
7. Returning `mcp-session-id` in the response headers.

Only `.session` is persisted. Other request context fields, such as locale, currency, store, tax jurisdiction, correlation id, IP address, and user agent, are expected to be supplied by the host per request.

### Session cache

By default, the package uses Reactionary `MemoryCache` for MCP session state. It keeps at most 10,000 entries by default and evicts the least recently used ones beyond that, which can drop live sessions; pass `new MemoryCache({ maxEntries })` through `sessionCache` to change the limit:

```ts
const mcp = new ReactionaryMCPServer(createClient);
```

For production or multi-instance deployments, provide any Reactionary `Cache` implementation:

```ts
const mcp = new ReactionaryMCPServer(createClient, {
  sessionCache: redisBackedReactionaryCache,
  sessionTtlSeconds: 60 * 60,
});
```

The cache is used only for the MCP session snapshot. Capability-level caching is still controlled by the Reactionary clients/capabilities created by your factory.

### Why not reuse one client?

Reactionary capabilities receive a mutable `RequestContext`. Several capabilities read or write session data:

- identity login/logout
- active user identity
- personalization profile
- cart-related provider state
- checkout state
- provider-specific session keys

If the HTTP handler reused a single client instance, all MCP sessions would share that context. That would allow one connected client to inherit another client's identity, token, active cart, or personalization state.

The adapter therefore creates a fresh client/context per request and restores only the session snapshot associated with the MCP session id.

## Resources and prompts

The package exposes a shopping-agent guide as both an MCP resource and an MCP prompt.

Resource URI:

```txt
reactionary://mcp/guide/shopping-agent
```

Prompt name:

```txt
reactionary-shopping-agent-guide
```

The guide explains how agents should combine Reactionary tools for product discovery, product details, price/inventory checks, cart operations, checkout, pagination, B2B context, and error handling.

The resource uses a Reactionary-owned URI scheme. Some clients, including VS Code, may show MCP resources internally as `mcp-resource://...`; that is a client-side virtual URI and not the URI the server should advertise.

See [`docs/shopping-agent-guide.md`](./docs/shopping-agent-guide.md).

## CLI

The package includes a small CLI for local demos and MCP Inspector testing.

```bash
pnpm --dir packages/mcp start
```

Defaults:

```txt
MCP_HOST=127.0.0.1
MCP_PORT=3000
MCP_PATH=/mcp
```

By default the CLI is locked down: it only exposes the read-only catalogue tools (`product-search`, `product`, `price`, `inventory`, `category`), only accepts requests whose `Host` and `Origin` are loopback, and refuses to listen on a non-loopback host unless a bearer token is configured. See [CLI security](#cli-security) for the flags that change this.

The CLI:

1. Loads `.env` from the project root.
2. Reads enabled provider systems from `ENABLED_<SYSTEM>=true`.
3. Creates a `ReactionaryMCPServer`.
4. Serves MCP over streamable HTTP.
5. Creates a fresh Reactionary client/context per MCP request/session.

Supported provider flags:

```txt
ENABLED_FAKE=true
ENABLED_MEDUSA=true
ENABLED_MAGENTO=true
ENABLED_COMMERCETOOLS=true
ENABLED_ALGOLIA=true
ENABLED_MEILISEARCH=true
ENABLED_UNOMI=true
```

Example:

```bash
ENABLED_FAKE=true pnpm --dir packages/mcp start
```

### Start without Inspector

Use this when you want to run the MCP HTTP server directly and connect any MCP-capable client yourself.

Fake provider demo:

```bash
ENABLED_FAKE=true pnpm --dir packages/mcp start
```

Custom host, port, and path:

```bash
ENABLED_FAKE=true pnpm --dir packages/mcp start -- --host 127.0.0.1 --port 3333 --path /mcp
```

Equivalent environment-variable form:

```bash
ENABLED_FAKE=true MCP_HOST=127.0.0.1 MCP_PORT=3333 MCP_PATH=/mcp pnpm --dir packages/mcp start
```

The server will listen at:

```txt
http://127.0.0.1:3333/mcp
```

Medusa-backed example:

```bash
ENABLED_MEDUSA=true \
MEDUSA_BASE_URL=http://localhost:9000 \
MEDUSA_PUBLISHABLE_KEY=pk_test_... \
MEDUSA_ADMIN_KEY=... \
pnpm --dir packages/mcp start
```

You can also put these variables in the project root `.env`; the CLI loads that file automatically.

### CLI security

The CLI serves the provider credentials from the environment (for example `MEDUSA_ADMIN_KEY`), so it must not be reachable by anything other than its intended clients. A web page open in a browser on the same machine can otherwise reach a loopback server, through DNS rebinding or a cross-origin request.

| Flag | Environment | Effect |
| --- | --- | --- |
| `--allowed-hosts a,b` | `MCP_ALLOWED_HOSTS` | Hostnames accepted in the `Host` header (no port). Default: `localhost`, `127.0.0.1`, `[::1]`, plus a specific non-loopback `--host`. Other hosts get `403`. |
| `--allowed-origins a,b` | `MCP_ALLOWED_ORIGINS` | Hostnames accepted in the `Origin` header (no scheme or port). Default: the allowed hosts. Requests without an `Origin` header, such as from non-browser clients, pass. Other origins get `403`. |
| none | `MCP_AUTH_TOKEN` | When set, every request must carry `Authorization: Bearer <token>`, otherwise `401`. Only available as an environment variable so it does not appear in the process list. |
| `--allow-insecure-remote` | `MCP_ALLOW_INSECURE_REMOTE=true` | Allows a non-loopback `--host` without `MCP_AUTH_TOKEN`. Without it, the CLI refuses to start. |
| `--enable-mutating-tools` | `MCP_ENABLE_MUTATING_TOOLS=true` | Exposes the tools of every enabled capability, including cart, checkout, identity, order, employee and company. |
| `--capabilities a,b` | `MCP_CAPABILITIES` | Exposes exactly these capabilities (by capability name, for example `product,cart`). Cannot be combined with `--enable-mutating-tools`. |

Examples:

```bash
# Read-only catalogue tools on loopback (the default)
ENABLED_FAKE=true pnpm --dir packages/mcp start

# Let an agent fill a cart as well
ENABLED_MEDUSA=true pnpm --dir packages/mcp start -- --capabilities product-search,product,price,inventory,category,cart

# All tools, reachable from other machines under mcp.example.com, behind a bearer token
ENABLED_MEDUSA=true MCP_AUTH_TOKEN=... pnpm --dir packages/mcp start -- \
  --enable-mutating-tools --host 0.0.0.0 --allowed-hosts mcp.example.com
```

Binding to a wildcard address (`0.0.0.0`, `::`) only accepts loopback `Host` headers until `--allowed-hosts` lists the names clients use.

### Inspector

For local development:

```bash
pnpm --dir packages/mcp inspect
```

This starts the local Reactionary MCP server and opens MCP Inspector against the configured server URL.

Fake provider with Inspector:

```bash
ENABLED_FAKE=true pnpm --dir packages/mcp inspect
```

Inspector against a custom local endpoint:

```bash
ENABLED_FAKE=true MCP_HOST=127.0.0.1 MCP_PORT=3333 MCP_PATH=/mcp pnpm --dir packages/mcp inspect
```

The inspector launcher starts the Reactionary MCP server first, then launches MCP Inspector using HTTP transport pointed at:

```txt
http://${MCP_HOST}:${MCP_PORT}${MCP_PATH}
```

For the defaults, that is:

```txt
http://127.0.0.1:3000/mcp
```

## Environment-backed client builder

`createReactionaryClientFromEnv(...)` is a convenience helper for demos and CLI usage. It mirrors the provider setup logic from the example Node package and enables capabilities based on environment variables.

Embedded applications do not have to use this helper. In production, prefer a host-owned client factory:

```ts
const mcp = new ReactionaryMCPServer((requestContext) => {
  return new ClientBuilder(requestContext)
    .withCache(myCapabilityCache)
    .withCapability(...)
    .build();
}, {
  sessionCache: mySessionCache,
});
```

## Integration examples

### Next.js route handler

```ts
// app/api/mcp/route.ts
import { ReactionaryMCPServer } from '@reactionary/mcp';
import { buildReactionaryClient } from '@/lib/reactionary';

const mcp = new ReactionaryMCPServer((requestContext) =>
  buildReactionaryClient({ requestContext }),
);

export async function POST(request: Request) {
  return mcp.fetch(request);
}

export async function GET(request: Request) {
  return mcp.fetch(request);
}
```

### Plain Node HTTP

```ts
import { createServer } from 'node:http';
import { ReactionaryMCPServer } from '@reactionary/mcp';

const mcp = new ReactionaryMCPServer(createClient);
const handler = mcp.toNodeHandler();

createServer(async (request, response) => {
  await handler(request, response);
}).listen(3000);
```

## Securing the endpoint

`ReactionaryMCPServer` does not authenticate or screen requests unless it is told to, so that existing hosts that already do this keep working unchanged. A server that a browser can reach, or that is exposed beyond a trusted network, should set these options:

```ts
import { localhostAllowedHostnames } from '@modelcontextprotocol/server';

const mcp = new ReactionaryMCPServer(createClient, {
  // DNS rebinding protection: only these Host header hostnames are served, others get 403.
  allowedHostnames: ['mcp.example.com', ...localhostAllowedHostnames()],
  // Cross-site request protection: browser requests from other origins get 403.
  allowedOriginHostnames: ['app.example.com'],
  // Authentication: runs after the checks above, a request it denies (or that makes it throw) gets 401.
  authorize: async (request) => isValidToken(request.headers.get('authorization')),
  // Only expose the tools the agent needs.
  toolFilter: (tool) => tool.entrypoint.capabilityName !== 'identity',
});
```

The checks apply to `fetch`, `getHandler().fetch` and `toNodeHandler()` alike. Subclasses can override the protected `rejectRequest(request)` to change how requests are screened.

## Guardrails and responsibilities

This package provides the MCP transport and generated tool surface. It does not replace application-level commerce policy.

Recommended host responsibilities:

- authenticate users before exposing sensitive/stateful capabilities
- authorize tool access by user, role, market, channel, or company
- rate limit agent traffic
- verify price and inventory before cart/checkout mutations
- enforce spend limits
- audit state-changing tool calls
- avoid exposing admin-only provider credentials to public agent clients

For a first demo, prefer a small surface:

1. Product search
2. Product detail / variant resolution
3. Price and inventory verification when available
4. Cart create/add/update
5. Checkout handoff later

## Current limitations and follow-ups

- MCP session persistence currently stores only `RequestContext.session`.
- The default MCP session store is in-memory and not suitable for multi-process production deployments.
- Some core schemas still contain legacy empty-object default factories for identifiers. The MCP schema converter avoids crashing on those, but core modeling should eventually distinguish required identifiers from optional/unknown values more explicitly.
- Monetary defaults currently use a temporary `0/EUR` fallback.
- Checkout/payment/ACP Instant Checkout support is intentionally not implemented in this first MCP package slice.

## Validation commands

Useful local checks:

```bash
pnpm exec tsc -p packages/mcp/tsconfig.spec.json --noEmit
pnpm exec vitest run --config packages/mcp/vitest.config.mts
pnpm exec nx run mcp:lint
pnpm exec nx run mcp:build
pnpm exec nx affected -t lint build test:offline
```
