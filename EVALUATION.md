# Evaluation
This is a temporary write-up in relation to the re-architecting of the client in order to get a better propagation of types up through the hierarchy.

## Glossary
- Capability: a single business domain that may be utilized by the consumer. Examples: Cart, Product, Category, ProductSearch.
- Capability Procedure: a single piece of exposed functionality within a business domain. Examples: Cart.addItem, Cart.removeItem, Product.getBySlug
- Provider: a single remote system providing a set of functionality. A provider may provide anywhere from a single capability to all the capabilities.
- Schema: the source of truth for input and output types. These need to provide both compile-time types, as well as runtime parsing / validation.
- Definition: the internal part of a capability or procedure, that is to say the definition of it BEFORE being converted to a client.
- Client: the final interface exposing the sum of business capabilities to the consumer.
- Global middleware: functionality that needs to run on all requests performed, across capabilities and providers, such as Telemetry or Caching.
- Contract: the minimum set of functionality expected to be exposed by providers of a given capability - both in terms of procedures, and the input / output for those procedures.

## OOTB use
The following are the cases, grouped by their respective importance, that should be considered for OOTB use. OOTB use in this context means "not customized" - that is, the perspective of just needing to get a new project going from scratch.

### Must haves
- Setup should be minimal.
- Enabling capabilities for providers should be type-safe and clear from the public interface.
- Providing configuration for providers should be type-safe and clear from the public interface.
- All OOTB providers should follow the same capability and procedure-level interface.

### Nice to haves
- ???

### Not important
- ???

### Unclear
- ???

## Customizations
The following are the cases, grouped by their respective importance, that should be considered for customization flows.

### Must haves
- It must be trivially possible to extend the input schema for a given procedure. Changing the input schema should reflect in the generated client and in the runtime validation.
- It must be trivially possible to extend the output schema for a given procedure. Changing the output schema should reflect in the generated client all the way up to the stack, and in the runtime validation.

### Nice to haves
- Having rigidly enforced entry-points for customization (eg. fetch / transform) for replacing only part of the logic of a given procedure. This is primarily for custom mappings.
- Being able to trivially replace not just the schema of a single procedure, but the schema for ALL procedures using that as an output type within a capability.
- Being able to trivially add parameters to operations performed towards backends, without having to override the entire handler or fetch step.

### Not important
- ???

### Unclear
- Should customizations be allowed to lower the minimum contract? That is, should a customization be able to add another mandatory field to the Cart.add input payload? Or would we expect this to be a new procedure, or optional? On one hand, it allows for cleanly slotting in other features (outside of @reactionary). On the other hand, it always ends up feeling very artificial in the project. As an example, imagine that a project legitimately REQUIRES an additional input to be passed along in order for a cart add operation to be valid. One could argue that the contract is primarily about providing a consistent experience between providers OOTB - not in project scope.

## Outstanding Work (V2 Transition)
### Contracts
- Port contracts for non-standard providers still pending:
  - `product-recommendations` (currently concrete default behavior + multicast pattern, not a pure abstract contract)
  - `analytics` (`Promise<void>`, not `Result`)
  - `product-associations` (returns arrays directly, not `Result`)
- Decide whether these should be normalized into `Result` in V2, or intentionally remain outside V2 contract scope.

### Provider Implementations (Commercetools package)
- Category is ported and tested.
- Remaining capabilities still need V2 implementation porting in `packages/commercetools`:
  - identity
  - inventory
  - price
  - order
  - order-search
  - store
  - product-search
  - profile
  - checkout
- Product and cart currently use placeholder/dummy handlers and need full logic porting.

### Runtime Validation and Middleware Pipeline
- Input/output runtime parsing is currently commented out in `core/src/v2/core/capability-procedure.ts`.
- Need final decision on where validation should happen in V2 pipeline (`fetch`, `transform`, both, or wrapper-level only).
- Define middleware/caching integration point in V2 client creation flow (current tests are being used as a staging ground for this).

### Mapping / Transformation Strategy
- Continue extracting provider-specific mappers so each domain type has a single reusable mapper per provider.
- Ensure parity and reuse across old/new code paths while old providers still coexist.

### Naming / Contract Shape Consistency
- Verify V2 procedure naming conventions across all capabilities (e.g. `byId` vs `getById`, `byTerm` vs `queryByTerm`) before broad provider porting.
- Confirm page/pagination semantics (`requested pageSize` vs `returned count`) as explicit contract behavior.

### Provider Implementations (Algolia package)
- Ported in `packages/algolia`:
  - product-search
- Not ported yet (no V2 contract available):
  - analytics
  - product-recommendations
