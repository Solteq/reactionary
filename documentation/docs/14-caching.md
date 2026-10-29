# Caching

Queries decorated for caching store their result through the `Cache` you give the `ClientBuilder` with `withCache`. Reactionary ships these implementations, all exported from `@reactionary/core`:

- `NoOpCache` stores nothing. Useful for tests, or to turn caching off.
- `MemoryCache` keeps entries in the memory of the process. For local development, not for production.
- `RedisCache` stores entries in Redis. It reads the connection URL from `REDIS_URL` unless you pass one.
- `CloudflareKvCache` stores entries in Cloudflare Workers KV.

## Cloudflare Workers KV

Add a KV namespace binding to the Worker in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "REACTIONARY_CACHE"
id = "<namespace id from `wrangler kv namespace create REACTIONARY_CACHE`>"
```

Pass the binding to the cache:

```ts
import { ClientBuilder, CloudflareKvCache } from '@reactionary/core';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const client = new ClientBuilder(requestContext)
      .withCapability(/* ... */)
      .withCache(new CloudflareKvCache(env.REACTIONARY_CACHE, { waitUntil: ctx.waitUntil.bind(ctx) }))
      .build();

    // ...
  },
};
```

`CloudflareKvCache` only needs the four methods of the binding it calls (`get`, `put`, `delete`, `list`), described by the exported `CloudflareKvNamespaceLike` interface, so core does not depend on `@cloudflare/workers-types`. The binding from `@cloudflare/workers-types` satisfies it.

### Options

```ts
new CloudflareKvCache(env.REACTIONARY_CACHE, {
  keyPrefix: 'shop-a:',
  trackDependencies: false,
  hashKeys: false,
  edgeCacheTtlSeconds: 120,
  waitUntil: ctx.waitUntil.bind(ctx),
});
```

- `keyPrefix` is put in front of every key, and is what `clear()` is limited to. The default is `reactionary:`. Use a different prefix per storefront when several share a namespace, and not one that starts with another's, because `clear()` of the shorter prefix also removes the keys of the longer one.
- `trackDependencies` (default `true`) writes one extra index key per dependency id of each entry, which `invalidate()` needs. Set it to `false` if you never invalidate and want to save KV writes. `invalidate()` then does nothing and entries only leave the cache when they expire.
- `hashKeys` (default `true`) replaces the cache key and the dependency ids in the KV keys by a SHA-256 digest, see below. Set it to `false` for readable keys.
- `edgeCacheTtlSeconds` is passed to KV as `cacheTtl`. It makes KV keep a read in the location that served it for that many seconds, which lowers latency, but a change made elsewhere is not seen for at least that long. Values under 30 are raised to 30. Not set by default, which leaves KV's default of 60 seconds.
- `waitUntil` is called with the promise of every `put`, so that the Worker keeps running until the write has finished when the response is sent first. Pass `ctx.waitUntil.bind(ctx)`. Without it a write that is still running when the response is sent can be cancelled and the entry is never stored. It does not delay the write: the write starts at once, `put` still returns its promise (which rejects if the write fails), and the promise given to `waitUntil` never rejects. Reads, deletes and `invalidate()` do not use it. Not set by default.

### How it behaves

- KV is eventually consistent. A write or delete can take 60 seconds or more to show in other locations, and a location that has read a key recently can keep returning the old value. A miss is cached as well, so an entry written after a miss can stay invisible for a while. A read after `put` or `invalidate` can therefore return the previous state. Cache data that tolerates that.
- Cloudflare's minimum `expirationTtl` is 60 seconds. The cache also stores the expiry inside the value and treats an entry past it as a miss, so TTLs under 60 seconds are honoured. The KV key itself lives for at least 60 seconds and is then removed by KV.
- Keys are limited to 512 bytes (UTF-8, including the prefix) and values to 25 MiB. With hashed keys (the default) the key limit cannot be reached. A `put` whose value is over the limit, or whose key is over it with `hashKeys: false`, is skipped with a `console.warn` and no error, and the entry is never cached.
- KV allows one write per second to the same key and answers with a 429 error beyond that. The error is thrown from `put`. `@Reactionary` does not wait for the cache write and logs the failure.
- A corrupt entry, or one that does not match the schema of the query, is a miss. Errors from the KV binding itself are not caught by the cache. What the caller sees then is decided by `@Reactionary`: unless it treats a failing cache as a miss, a failed `get` turns the query into a `Generic` error result.
- On Workers, work still running when the response is sent can be cancelled unless it is registered with `ctx.waitUntil`. `@Reactionary` does not wait for a cache write, so pass `waitUntil` as an option to get the write registered. Without it a write can be lost that way, which only costs a later miss.

### Hashed keys

Cache keys built by `@Reactionary` contain a hash of the query, but dependency ids and keys from other users of the cache can be long, and a KV key over 512 bytes cannot be written. By default the cache therefore stores an entry under `<prefix>entry:<digest of the cache key>` and its index keys under `<prefix>dep:<digest of the dependency id>:<digest of the cache key>`. The digest is SHA-256 from Web Crypto (`crypto.subtle`, available in Workers and Node 18+) as 43 characters of base64url, so a key is about 100 bytes whatever the input.

The original cache key is stored in the entry, and written as KV metadata (`{"key": "..."}`, cut to the 1024 bytes of JSON KV allows). To find an entry in the Cloudflare dashboard or with `wrangler kv key list`, read the key from the metadata of the listed entries instead of from the key name. When a read finds an entry whose stored key differs from the key asked for, which would need a SHA-256 collision, it is a miss.

With `hashKeys: false` the keys are the readable text (`<prefix>entry:<cache key>`, and `<prefix>dep:<URI-encoded dependency id>:<cache key>`). An entry whose key or index key would be over 512 bytes is then skipped with a warning, and a dependency id with a lone surrogate character makes `put` and `invalidate` throw. Changing `hashKeys` on an existing namespace leaves the old entries unreachable until they expire, so `clear()` first.

To use another hash, subclass `CloudflareKvCache` and override the protected `digest` method. Its output should not contain `:` and should be short enough to keep keys under 512 bytes.

### Invalidation

KV has no sets and no atomic read-modify-write, so a list of cache keys per dependency id would lose entries when two requests update it at once. The cache writes one small key per dependency id and cache key instead (`<prefix>dep:<dependency id>:<cache key>`, hashed as above), with the same expiry as the entry. `invalidate(ids)` lists the keys with the prefix of each id, rebuilds each entry key from the last part of the index key, deletes the entries and then the index keys, and follows the list cursor through all pages.

`put` writes the index keys before the entry, so a `put` that fails part way cannot leave an entry without an index key, and with `hashKeys: false` an entry whose index keys do not fit in 512 bytes is not stored. A `put` that runs at the same moment as an `invalidate` for one of its dependency ids can still leave an entry that stays until its TTL. Listing is eventually consistent too, so an entry written moments before `invalidate` may not be found.

A `put` costs one KV write for the entry plus one per dependency id. The default `generateDependencyIdsForModel` returns at most one id, so that is two writes. A capability that returns many ids multiplies the writes, and on the Workers Free plan 50 subrequests per invocation is the ceiling.

Every key costs one KV operation to delete, and a Worker invocation can only make a limited number of them (1,000 according to the KV limits page, and 50 subrequests on the Workers Free plan, 10,000 on Paid). Invalidating dependency ids with many entries can reach that limit and fail part way. The remaining entries are removed by running it again.

### Clearing

`clear()` lists every key under the prefix and deletes them one by one. With a large cache that is many operations, so use it for tests and administration, not while serving requests. With an empty `keyPrefix` it removes every key in the namespace.

### Cloudflare documentation

- [Limits](https://developers.cloudflare.com/kv/platform/limits/)
- [How KV works](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- [Write key-value pairs](https://developers.cloudflare.com/kv/api/write-key-value-pairs/)
- [Read key-value pairs](https://developers.cloudflare.com/kv/api/read-key-value-pairs/)
- [List keys](https://developers.cloudflare.com/kv/api/list-keys/)
- [Delete key-value pairs](https://developers.cloudflare.com/kv/api/delete-key-value-pairs/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
