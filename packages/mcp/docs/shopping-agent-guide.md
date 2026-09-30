# Reactionary MCP Shopping Agent Guide

This guide explains how an agent should combine Reactionary MCP tools when helping a shopper. It is based on the Reactionary documentation under `documentation/docs`, especially product data, product search, cart, checkout, and query/mutation conventions.

## Core mental model

Reactionary is a stateless commerce abstraction layer. It exposes vendor-independent capabilities such as product data, product search, price, inventory, cart, checkout, identity, orders, and personalization. The host application owns session state, routing, user confirmation, and business policy.

Each MCP tool maps to a decorated Reactionary capability method. Tool inputs are object payloads:

- Queries read data.
- Mutations change state.
- List queries should use pagination options. Reactionary avoids unbounded list requests.

Do not invent identifiers. Product, SKU, variant, cart, checkout, customer, company, and order identifiers must come from prior tool results or explicit user-provided data.

## General safety rules

1. Prefer read-only tools before mutation tools.
2. Treat cart, checkout, identity, profile, company, employee, and order-changing tools as state-changing.
3. Ask the user before making a state-changing cart or checkout operation unless the user clearly requested that exact change.
4. Verify the selected product variant/SKU before adding it to a cart.
5. Verify price and inventory when those tools are available, especially before cart mutation or checkout handoff.
6. After a mutation, read back the resulting object or use the returned object as the new source of truth.
7. If a tool returns an error, do not guess the missing data. Explain what failed and ask for clarification or retry with corrected inputs.
8. If search results are ambiguous, ask the user to choose before adding to cart.

## Product discovery flow

Use this flow for open-ended shopper requests such as "find coffee mugs" or "show me running shoes":

1. Call `productSearch.queryByTerm` with the user's search term and pagination options.
2. Present a small set of relevant products. Include names, visible variant/SKU information, and facets if useful.
3. If the user selects a product, use product detail tools such as `product.getBySlug`, `product.getBySKU`, or `product.getById` to obtain the exact product and buyable variant.
4. Remember that Reactionary uses a Product/Variant model. A variant is the buyable SKU. Search results are optimized for product listing pages and may contain only enough variant data for display and selection.
5. Do not add a product to cart from a search result unless the result clearly identifies the intended buyable variant.

## Product detail flow

Use product detail tools when the user names a specific product, slug, SKU, or when a prior search result needs exact data:

1. Use `product.getBySlug` for PDP-style links or SEO slugs.
2. Use `product.getBySKU` when the cart or user gives a SKU/variant.
3. Use `product.getById` only when the identifier came from Reactionary or the user explicitly provides it.
4. When a product has multiple variants, ask the user to choose the intended variant unless one is already selected.
5. For cart and checkout items, prefer SKU/variant identifiers from the item itself and hydrate display data with `product.getBySKU` if needed.

## Price and inventory flow

Product search results do not necessarily include authoritative price and inventory. When price or inventory tools are available:

1. Use `price.getCustomerPrice` when the current shopper context may affect pricing.
2. Use `price.getListPrice` when a public/list price is enough.
3. Use inventory tools before promising availability.
4. If price or stock cannot be verified, state that uncertainty clearly before proceeding.
5. Re-check before checkout or payment handoff if the cart may be stale.

## Cart flow

Reactionary supports multiple concurrent carts. There is no universal "active cart"; the host application or shopper chooses which cart to use.

Recommended cart flow:

1. If a cart identifier is already known, use it.
2. If not, list carts if the relevant cart capability is available and the user's context supports it.
3. Do not create an empty placeholder cart just to browse. Create a cart when the shopper actually wants to add something.
4. Before adding, resolve the product to an exact variant/SKU and quantity.
5. Optionally verify price and inventory.
6. Call the cart add/update mutation.
7. Use the returned cart or read the cart again.
8. Summarize the resulting cart: item, quantity, estimated price/total when available, and next actions.

For add-to-cart, the expected pattern is:

1. Product search or detail lookup.
2. Variant/SKU selection.
3. Cart create or cart selection.
4. Cart add.
5. Cart read/summarize.

## Checkout flow

In Reactionary, the cart records product selections and calculates price. Checkout is a separate session created from a cart. Once checkout starts, consider the cart read-only unless project-specific rules say otherwise.

Recommended checkout flow:

1. Ensure the user explicitly wants to start checkout.
2. Read or use the latest cart.
3. Verify price and inventory where tools exist.
4. Initiate checkout from the cart.
5. Use checkout tools to set shipping address, shipping instruction, payment instruction, and finalize according to available capabilities.
6. Never claim payment has succeeded unless the relevant checkout/payment tool confirms it.

For the current minimal demo scope, checkout/payment handoff may be intentionally disabled. In that case, stop after cart creation/addition and explain that checkout is not available in this MCP surface.

## Pagination and list handling

Reactionary list queries use `paginationOptions` with 1-based pages. Prefer small page sizes for agent interactions, for example 5 to 12 items. Do not request unbounded lists.

When refining product search:

1. Keep the prior search state where possible.
2. Add selected facets/filters.
3. Reset `pageNumber` to 1 after changing filters.
4. Use additional pages only when the user asks for more.

## B2B considerations

Some carts, prices, catalogs, lists, and checkout permissions may depend on company context. Do not move a cart from one company to another. If the user asks to buy for a company, make sure company context and permissions are clear before mutating carts or checkout.

## Error handling

Reactionary tools return structured success/failure results through MCP. If a tool fails:

- Do not silently continue as if the operation succeeded.
- Do not fabricate missing identifiers or prices.
- Explain the failing step in shopper-friendly language.
- Ask for a correction when the problem is ambiguous.
- Retry only with changed inputs or when the failure is clearly transient.

## Suggested agent behavior

Be concise and transactional. For shopping flows, users usually need:

- A short result list.
- A clear recommendation or disambiguation question.
- Exact confirmation before mutation.
- A post-mutation summary.

Avoid exposing implementation details unless the user asks.
