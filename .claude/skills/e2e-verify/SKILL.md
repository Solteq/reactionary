---
name: e2e-verify
description: Verify a change to reactionary against the real backends with the live capability specs in examples/node. Use when the user asks to verify with e2e, run the e2e tests, or check that a large change (core, a provider, search, cart, checkout) still works with live connections.
---

The live specs in `examples/node/src/capabilities` run each capability against the real backends in `.env` (Medusa, Algolia, Meilisearch, commercetools, Magento, Unomi; Fake needs none). Unit tests mock the clients. These do not, so they are what shows that a provider still works after a large change.

## Run

1. Say what changed: `git diff --stat origin/main...HEAD` plus uncommitted files.
2. Check the backends first, from the repo root:
   `pnpm --dir examples/node e2e --check`
   It lists each provider as reachable, not configured, not reachable (with the reason when it knows it: a sandbox firewall block, or the offline hours), or no backend needed (Fake). It exits 0 whatever it finds.
3. Pick the scope from the change, then run it:

   | Changed | Providers | Specs (`--spec`) |
   | --- | --- | --- |
   | `packages/core` search schemas or `utils/search-*` | all reachable | `product-search` |
   | `packages/<provider>/**/product-search*` | that provider | `product-search` |
   | cart, checkout, order, price, inventory, product, category, profile, identity, list code | the provider of the package | the spec file of that name (`--spec cart`) |
   | core decorators, client builder, cache, shared schemas, anything wide | all reachable | no `--spec` (everything) |

   `pnpm --dir examples/node e2e --provider Algolia,Meilisearch --spec product-search`

   Without `--provider` it runs every provider that can be reached. Extra vitest arguments go after `--`, e.g. `-- --reporter=verbose`.

   Providers are picked by a name filter on the test titles, so a `describe.each` over providers must have `%s` in its title ("Cart Capability - %s"). A title without it is never run by this script. Say so if the report lists a spec that ran no tests.
4. The facet semantics are in `product-search-facet-semantics.spec.ts`: typed facets (price, rating, availability, taxonomy, attribute), counts that are true, multiselect, and refusal of filters a provider cannot apply. Run it for any change to search.

## Report

Per provider and spec file: passed, failed, skipped with the reason vitest prints. State plainly:

- A skip is not a pass. "No rating facet in this index" means rating was not checked. List what was not checked.
- A provider that was not reachable was not verified. Say so, with the reason.
- A failure is a finding. Work out whether the provider or the test is wrong before touching either, and ask before changing a test to make it pass. Never loosen an assertion to get green.
- If the failure is a count that is not true or a filter that is dropped, that is a bug in the provider.

## Limits

- Some specs are red without any change of yours. On a clean main, `product-review.spec.ts` fails 2 tests for Fake (rating summary is 0, review pagination returns 0). Compare with a clean checkout before blaming the change.
- A count check compares two requests to the live index, so an index that changes in between can give a one-off mismatch by one. Rerun it before calling it a bug.
- The script's reachability check uses Node's `fetch`. Where a proxy is needed (the sandbox) Node must be told to use it (`NODE_USE_ENV_PROXY=1`), or every backend shows as not reachable without a reason.
- The shared Medusa, Meilisearch and Unomi backends are off 19:00-07:00 Europe/Copenhagen and at weekends. `--check` says so. Do not wait for them, report it.
- The cart, checkout, profile, company and list specs create real carts, users and lists on the backends. Only run them against demo backends, never against production credentials.
- In the Claude sandbox, a host that is not allowed answers 403 "Approval required for <host>". Ask the user to approve it (`sbx policy approval ls`, `sbx policy approval respond ...`). Do not work around it.
- The specs find their data in the index. They are not a fixed catalogue, so a skip can appear or go away when the index changes.
