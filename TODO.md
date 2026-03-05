# TODO

## 1. Fix Immediate Initializer Bug
- [x] In `providers/commercetools/src/core/initialize.ts`, fix `caps.order` assignment (`client.store` -> `client.order`).

## 2. Decide Capability Override Scope
- [x] Decide scope: use object-based capability config for all regular capabilities (`{ enabled: boolean }`), while keeping typed `factory/provider` overrides strongest for `product` and `checkout`.
- [x] Update:
  - `providers/commercetools/src/schema/capabilities.schema.ts`
  - `providers/commercetools/src/core/initialize.types.ts`
  - `providers/commercetools/src/core/initialize.ts`

## 3. Cleanup `initialize.types.ts`
- [ ] Reduce generic/type complexity now that all regular providers are factory-ported.
- [ ] Split into smaller helper modules if it improves readability.

## 4. Remove Legacy Parsing Leftovers
- [ ] Audit providers for parse helpers now duplicated by factories.
- [ ] Move remaining parsing-only logic to factory classes for consistency.

## 5. Add Factory Inference Examples / Tests
- [ ] Add compile-time examples/tests for newly factory-backed providers (minimum: `price`, `cart`, `profile`).
- [ ] Verify:
  - default/base schema inference
  - extended schema inference
  - provider override still preserves type flow

## 6. Decide Runtime Validation Strategy
- [ ] Decide whether `@Reactionary` output schema should stay base-schema or be bound to factory schemas.
- [ ] If binding to factory schemas, design and implement runtime integration approach.
