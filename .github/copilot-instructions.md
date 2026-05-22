# Reactionary — Copilot Instructions

## Project structure

This is an Nx monorepo of TypeScript packages that implement a unified commerce abstraction layer called **Reactionary**.

| Path                      | Package                      | Purpose                                                            |
| ------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| `packages/core/`          | `@reactionary/core`          | Shared types, schemas, base capability classes, factory interfaces |
| `packages/hcl/`           | `@reactionary/hcl`           | HCL Commerce provider — the primary provider package               |
| `packages/fake/`          | `@reactionary/fake`          | In-memory fake for testing consumers                               |
| `packages/algolia/`       | `@reactionary/algolia`       | Algolia search adapter                                             |
| `packages/commercetools/` | `@reactionary/commercetools` | commercetools adapter                                              |
| `packages/medusa/`        | `@reactionary/medusa`        | Medusa adapter                                                     |

Use `packages/medusa/` as the reference when scaffolding a new provider package — it has the cleanest structure.

---

## Build, lint, and test commands

```bash
# Build HCL package (also builds core)
npx nx build hcl

# Lint
npx nx lint hcl

# Type-check lib only
npx tsc -p packages/hcl/tsconfig.json --noEmit

# Type-check tests too (spec tsconfig includes test files)
npx tsc -p packages/hcl/tsconfig.spec.json --noEmit

# Run integration tests (requires .env with live credentials)
source .env && npx vitest run --config packages/hcl/vitest.config.mts
```

All source files are ESM-only. Always use `.js` extensions in imports even for `.ts` sources.

---

## HCL Commerce architecture

HCL Commerce exposes two distinct service tiers with separate base URLs:

| Tier                    | `HclClient` property        | URL pattern                              | Purpose                                                      |
| ----------------------- | --------------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| Query Service           | `client.catalogBaseUrl`     | `{apiUrl}/search/resources`              | Product catalogue, categories, search — read-only, cacheable |
| WCS Transaction Service | `client.transactionBaseUrl` | `{apiUrl}/wcs/resources/store/{storeId}` | Cart, checkout, identity, pricing, espots, events — stateful |

Always call the correct tier. Mixing them causes auth or path errors.

---

## Capability pattern

Each capability class:

1. Extends a base class from `@reactionary/core` (e.g. `ProductRecommendationsCapability`)
2. Is generic over `TFactory` — the factory that parses API responses
3. Receives `cache`, `context`, `config`, `client`, and `factory` via constructor
4. Annotates public methods with `@Reactionary({ inputSchema, outputSchema })` for validation and caching

```typescript
export class HclFooCapability<TFactory extends FooFactory = HclFooFactory> extends FooCapability<FooFactoryOutput<TFactory>> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly client: HclClient,
    protected readonly factory: FooFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
  }

  @Reactionary({ inputSchema: FooQuerySchema, outputSchema: FooSchema })
  public override async getFoo(query: FooQuery): Promise<Result<FooFactoryOutput<TFactory>>> {
    const response = await this.client.callGet<HclFooResponse>(this.getFooUrl(query), this.getFooParams(query));
    return success(this.factory.parseFoo(this.context, response));
  }

  protected getFooUrl(query: FooQuery): string {
    return `${this.client.catalogBaseUrl}/api/v2/foo/${encodeURIComponent(query.key)}`;
  }

  protected getFooParams(query: FooQuery): URLSearchParams {
    const params = new URLSearchParams();
    params.set('storeId', this.config.storeId);
    return params;
  }
}
```

**Capabilities without factory output** (e.g. `HclAnalyticsCapability`) do not use a `TFactory` generic — they fire-and-forget and return a fixed `AnalyticsResult` type.

---

## Extension point pattern (URL + params/payload)

**Every capability method that calls an external API must expose the URL and parameters as protected overridable methods.** This is the primary extension mechanism for project-specific customisations.

Naming conventions:

| What                   | Method name                  | Return type              |
| ---------------------- | ---------------------------- | ------------------------ |
| URL for a GET/POST     | `getXxxUrl(relevantArgs)`    | `string`                 |
| Query params for a GET | `getXxxParams(relevantArgs)` | `URLSearchParams`        |
| Body for a POST        | `getXxxBody(relevantArgs)`   | `Record<string, string>` |

The main data-fetching method calls these extension points — it never hardcodes URLs or params inline:

```typescript
// ✅ Correct — URL and params extracted
protected async fetchSegments(personalizationId: string): Promise<string[]> {
  const response = await this.client.callGet<HclSegmentResponse>(
    this.getSegmentsUrl(),
    this.getSegmentsParams(personalizationId),
    { allowUndefined: true },
  );
  // ...
}

protected getSegmentsUrl(): string {
  return `${this.client.transactionBaseUrl}/segment`;
}

protected getSegmentsParams(personalizationId: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set('q', 'byPersonalizationId');
  params.set('qPersonalizationId', personalizationId);
  return params;
}

// ❌ Wrong — hardcoded inline, impossible to override
protected async fetchSegments(personalizationId: string): Promise<string[]> {
  const params = new URLSearchParams();
  params.set('q', 'byPersonalizationId');
  const response = await this.client.callGet(
    `${this.client.transactionBaseUrl}/segment`, params
  );
}
```

Real examples in this codebase:

- `HclInventoryCapability` → `getBySKUUrl`, `getBySKUPayload`
- `HclProductRecommendationsCapability` → `getEspotUrl`, `getEspotParams`
- `HclAnalyticsCapability` → `getEventUrl`, `getEventBody`
- `HclProductAssociationsCapability` → `getProductsUrl`, `getProductsParams`
- `HclPersonalizationProfileCapability` → `getSegmentsUrl`, `getSegmentsParams`

---

## Factory pattern

Factories parse raw HCL API responses into typed domain models.

### Core factory interface (in `@reactionary/core`)

```typescript
// packages/core/src/factories/foo.factory.ts
export type AnyFooSchema = z.ZodType<z.output<typeof FooSchema>>;

export interface FooFactory<TFooSchema extends AnyFooSchema = AnyFooSchema> {
  fooSchema: TFooSchema;
  parseFoo(context: RequestContext, data: unknown): z.output<TFooSchema>;
}

export type FooFactoryOutput<TFactory extends FooFactory> = ReturnType<TFactory['parseFoo']>;

export type FooFactoryWithOutput<TFactory extends FooFactory> = Omit<TFactory, 'parseFoo'> & {
  parseFoo(context: RequestContext, data: unknown): FooFactoryOutput<TFactory>;
};
```

Export from `packages/core/src/factories/index.ts`.

### HCL-specific factory implementation

```typescript
// packages/hcl/src/factories/foo/foo.factory.ts
export class HclFooFactory<TFooSchema extends AnyFooSchema = typeof FooSchema> implements FooFactory<TFooSchema> {
  constructor(public readonly fooSchema: TFooSchema) {}

  parseFoo(_context: RequestContext, data: HclFooData): z.output<TFooSchema> {
    return this.fooSchema.parse({
      // map HCL fields to domain model
    });
  }
}
```

Export from `packages/hcl/src/factories/index.ts`.

### Rules

- Factories **always** receive the schema via constructor — never hardcode the schema class inside the factory
- All response parsing lives in factories — capability methods must not call `.parse()` directly on domain schemas
- Factory output is validated through the injected schema, so subclasses can extend the schema type

---

## Wiring capabilities in `initialize.ts`

Use `resolveCapabilityWithFactory` for every capability that has a factory:

```typescript
if (caps.foo?.enabled) {
  client.foo = resolveCapabilityWithFactory(
    capabilities.foo as HclFooCapabilityConfig | undefined,
    {
      factory: new HclFooFactory(FooSchema),
      capability: (args) => new HclFooCapability(args.cache, args.context, args.config, args.hclClient, args.factory),
    },
    buildCapabilityArgs,
  );
}
```

`resolveCapabilityWithFactory` lets callers override either the factory or the whole capability class by passing `{ factory, capability }` in the capabilities config object.

For capabilities without factories (e.g. analytics), construct directly:

```typescript
if (caps.analytics?.enabled) {
  client.analytics = new HclAnalyticsCapability(cache, context, config, hclClient);
}
```

### `HclXxxCapabilityConfig` types

Each capability gets a config type in `packages/hcl/src/schema/capabilities.schema.ts`:

```typescript
export type HclFooCapabilityConfig = HclCapabilityConfig<FooFactoryWithOutput<FooFactory>, FooCapability>;
```

Import `FooFactory` and `FooFactoryWithOutput` from `@reactionary/core`.

---

## Testing pattern

**All tests are integration tests against a live HCL Commerce server.** There are no mocks.

### Test file conventions

- Location: `packages/hcl/src/test/<capability-name>.capability.spec.ts`
- Top comment: `// Demo server: www-latestdevauth.demo.solteq.io, storeId=41`
- `testData` const at the top with the specific product/category identifiers used

### Test setup for factory-based capabilities

Instantiate the capability directly (not via `createHclClient`) so the factory type is explicit:

```typescript
beforeEach(() => {
  reqCtx = createInitialRequestContext();
  const config = getHclTestConfiguration();
  const client = new HclClient(config, reqCtx);
  provider = new HclFooCapability(new NoOpCache(), reqCtx, config, client, new HclFooFactory(FooSchema));
});
```

### Test setup for capabilities without factories

```typescript
beforeEach(() => {
  reqCtx = createInitialRequestContext();
  const config = getHclTestConfiguration();
  const client = new HclClient(config, reqCtx);
  provider = new HclAnalyticsCapability(new NoOpCache(), reqCtx, config, client);
});
```

### Assertions

- Use `assert(result.success, ...)` before accessing `result.value` — this narrows the type and gives a clear failure message:
  ```typescript
  assert(result.success, `Expected success, got: ${JSON.stringify(result)}`);
  ```
- For fire-and-forget results (analytics), accept both `accepted` and `rejected` — the live demo may not have the event endpoint configured:
  ```typescript
  expect(['accepted', 'rejected']).toContain(result.outcomes[0].outcome);
  ```
- For list results that may be empty on the demo server (espots, segments), assert shape not count:
  ```typescript
  expect(Array.isArray(result.value)).toBe(true);
  expect(result.value.length).toBeLessThanOrEqual(query.numberOfRecommendations);
  ```
- Test environment credentials come from `.env` (gitignored). The template is `.env-template`.

---

## Common HCL Commerce quirks

- **Product attributes** use a `string | string[]` zip pattern — multiple values in the same entry are stored as parallel arrays. See `flattenAttributeValues` in `product.factory.ts`.
- **Slug resolution** uses `GET /search/resources/api/v2/urls?identifier=<slug>`. The slug resolves to `tokenValue` (a numeric uniqueID for categories) or `partNumber` for products — never use `tokenExternalValue`.
- **Category breadcrumb** is encoded in `parentCatalogGroupID` as `/10501/10503` — split by `/`, the second-to-last segment is the direct parent.
- **Profile names** control what fields the Query Service returns. Extra fields (e.g. `merchandisingAssociations`, `attachments`) are server-config-dependent and absent on the demo server even with the same profile name.
- **`catalogBaseUrl`** defaults to `{searchApiUrl}/search/resources` (separate from `apiUrl` for deployments where search runs on a different host).
- **`allowUndefined: true`** in `callGet` opts into returning `undefined` instead of throwing on 404 — use it for endpoints that may legitimately return nothing (espots, segments).
