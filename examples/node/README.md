# examples-node

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build examples-node` to build the library.

## UCP Express server

`src/ucp-express-server.ts` is a small Express host for `@reactionary/ucp`. It loads `.env` with the same project-root dotenv helper as `@reactionary/mcp` and creates the Reactionary client through `createReactionaryClientFromEnv`.

Run it with:

```bash
pnpm --dir examples/node ucp:express
```

or directly from the example package directory:

```bash
cd examples/node
node --loader @swc-node/register/esm src/ucp-express-server.ts
```

Server options can be supplied either as CLI flags or environment variables:

| CLI flag | Environment variable | Default |
| --- | --- | --- |
| `--host` | `UCP_HOST` | `127.0.0.1` |
| `--port` | `UCP_PORT` / `PORT` | `3000` |
| `--path` | `UCP_PATH` | `/ucp` |
| `--endpoint` | `UCP_ENDPOINT` / `UCP_PUBLIC_URL` | `http://{host}:{port}{path}` |

UCP profile metadata comes from:

| Environment variable | Purpose |
| --- | --- |
| `UCP_MERCHANT_NAME` | Merchant name in `/.well-known/ucp` |
| `UCP_MERCHANT_URL` | Merchant URL in `/.well-known/ucp` |
| `UCP_MERCHANT_CONTACT_EMAIL` | Merchant contact email |
| `UCP_MERCHANT_CONTACT_PHONE` | Optional merchant contact phone |
| `UCP_PUBLIC_KEYS_JSON` | Optional JSON array of public JWK objects |

Enable Reactionary providers with the same variables as `@reactionary/mcp`, for example:

```dotenv
ENABLED_MEDUSA=true
MEDUSA_API_URL=http://localhost:9000
MEDUSA_PUBLISHABLE_KEY=pk_test_...
MEDUSA_ADMIN_KEY=sk_...
MEDUSA_DEFAULT_CURRENCY=EUR
```

The server exposes:

- `GET /.well-known/ucp`
- canonical Shopping REST below `UCP_PATH`, for example `POST /ucp/catalog/search`

## Running unit tests

Run `nx test examples-node` to execute the unit tests via [Jest](https://jestjs.io).
