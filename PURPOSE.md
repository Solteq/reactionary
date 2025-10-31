# Purpose for Reactionary

The following are the core things we aim to solve with Reactionary.

- To standardize the Solteq approach to developing clients in a composable setup, without getting *too* locked in to any one choice of provider.
- To allow developers to focus on their area of expertise, without the platforms getting in the way. Frontend developers should be able to work on the frontend without knowing the ins and outs of every system involved in every project, and without knowing how query and mutate data against a specific platform.
- To allow easier bootstrapping of greenfield projects, and easier transitioning between offerings that are part of Solteq's portfolio.
- To encode best practices for working in a composable world.

It is important here to note that the goal is not inherently to create something that is *universally* useful or advantageous, but rather something that is useful within Solteq.

## Standards

Here we aim to document some of the standards that are implicitly being encoded in the framework, and their reasons for being.

### Publically known identifiers

Every system **must** use publically known identifiers for operations on cross-cutting domains.

An example here would be Product. Operations on this should use a publically known identifier in the organization (such as GTIN or Partnumber) for adding it to the cart, updating data projections and similar. This is to ensure that systems are substituable for each other. The moment internal identifiers start being used (such as add-to-cart requiring the internal database ID of the product in the ecom platform) several unpleasentries start happening:

- You now need to synchronize data out from Ecom to other systems such as Search, since the unique ID becomes required for effectively using the product. This moves the effective master of product data from PIM to Ecom, and introduces a hard dependency on the current Ecom platform of choice. Adding more hard links between systems becomes a pain in a distributed world.
- Support becomes harder. As an example, your traces will now contain the unique ID, but when communicating with the client that identifier will be meaningless to them.

The important part here is that the identifiers of domains with cross-cutting use shouldn't be decided on a per-system basis, but an organizational basis. When referencing an entity by its identifier (whether between systems or between humans) it should be clear to all parties. Below follows the current list of identifiers being used:

| Domain | Identifier | Notes |
|--------|------------|-------|
| Product | SEO Slug | |
| SKU | Partnumber | Partnumber is typically originiating from the organizations ERP, and is as such typically the weakest candidate for a global choice, but it may have the positive upside of being the "best known" candidate in the scope that matters. |
| Category | SEO Slug | |
| Customer | Email address | This may not be universally true, but since this seems to be the established reality in all CRM systems (because they care about emailing things) we may as well conform. |
| Organization | Tax ID | |
| Cart | | |
| Store | | |
| Inventory | | |
| Price | | |
| Shipping | | |
| Payment | | |
| Address | | |

### Backend-for-frontend (BFF)

By providing a Node-based framework rather than one suitable for being embedded in the browser for direct client-side rendering, we are implicitly opting and advocating for the BFF approach. There are upsides and downsides to this approach, but from past experience it is our judgement that it is the better choice.

- Upsides
   - Cross-transactional query caching becomes possible, for performance.
   - Bundle size is greatly reduced, from not having to bundle in every vendor's client, increasing performance.
   - Centralized rate-limiting and observability becomes possible.
- Downsides
   - Additional hosting costs.
   - Increased complexity.

An additional point to note is that some platform providers may not even provide a user-facing client in the first place or might actively be discouraging its use, instead opting for a set of platforms credentials unsuitable for client consumption.

How the BFF implementation is ultimately realized depends to a large degree on the frontend framework of choice. For pure server-side rendering there is no real decision to be made. For Next the logical choice is to use Server Actions. For Angular and similar typescript-based frameworks, TRPC is a solid choice.

### Observability

Observability, in the form of metrics and traces, should be core to the lifecycle and maintenance of a solution. Without this it becomes exceedingly difficult to navigate error reports and complaints about performance in a world of distributed systems.

To this end Reactionary provides OpenTelemetry (OTEL) instrumentation on the provider-level to ensure that queries and operations are recorded and that they can be made available in the collector of choice.

### Type safety

Type safety here is viewed through the lens of achieving multiple goals:

- A reduction in bugs due to mismatched fieldnames or types.
- A desire to ensure that new developers on a project are able to get up to speed through a set of expectations about the domain, without having to build up and maintain that domain knowledge through experience.
- To enable cross-cutting domain operations in a standardized fashion. One such example would be to ensure that standardized integrations for analytics can be done, since we know the input we will be mapping.

Reactionary relies on Zod schemas for type-safety, to ensure that it is enforced at runtime. Frontend developers should not have to deal with data having to be handled on their end that does not adhere to the schema. This should be an error before even reaching them.

### Swappable providers

A goal in creating a standardized model for capabilities is to ensure that they are interchangeable with each-other. This is done in part in order to facilitate easier transition between providers as part of the project lifecycle, but also to ease the development process. Reactionary aims to provide fake providers for all capabilities. These are not intended for any kind of production use, but rather for use in scenarios where running against a real system is impossible, such as:

- The concrete backend system is not yet known, only the desired functionality.
- The backend system is not available for testing designs, or does not provide sufficient data for testing designs.

In these cases it is still desirable for frontend developers to be able to iterate on the design and continue their work based on the contract between the BFF and Client, even in the absence of a final system of choice.

### UX-centric APIs

