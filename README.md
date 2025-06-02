# Reactionary

Reactionary is a framework-agnostic client library for standardized data access, building upon the previous learnings from Perpendicular. It is decidedly opinionated. Compared to Perpendicular it:

- it favors keeping the providers on the server in order to:
  - keep the client bundle minimal for performance.
  - allow for cross transactional caching.
  - standardize observability.
  - control access, allowing for session features like rate limiting.
- it favors serializable, parseable domain models
  - allows for caching and state transfer.
  - allows for extensible, typesafe data at runtime.

## Contributing

### Running locally

The includes examples generally require `.env` to be configured with the relevant API keys. We can likely create a setup for this in Vault, for easy bootstrapping.

### Pull requests

For new features, branch from `main` and create a pull request towards `main` upon feature completion. Please observe the following guidelines:

- Preserve a linear history. This means rebasing on `main`, rather than merging. PR's containing merge commits should be considered unmergeable.
- Observe [https://www.conventionalcommits.org/en/v1.0.0/#summary][conventional commit message guidelines] for the rebased pull request commits.
- Ensure that the PR is linked to an issue.

## Glossary

The following is a short list of commonly used terms and phrases, to keep guessing to a minimum.

- *Provider:* a backend service providing an API that can be consumed. HCL or Commercetools would be examples of ecom providers, while Algolia would be an example of a search provider.
- *Capability:* a capability (or more fully, a business capability) is a discrete area of functionality that may be provided to the consuming party. An example would be *Cart*, providing a domain model and a set of discrete operations that can be performed on it, like adding a product or removing a product.
- *Gateway:* a serverside process encapsulating a set of capabilities. This could be a trpc router, or it could be react server. The purpose here is to ensure that all of the dependencies and environmental configuration stays on the server, rather than the client.
- *Client:* the client facade to the gateway. In trpc this is would be the trpc client. It can be bundled into client-side rendering code.
- *Observability:* means of providing insights into the workings of the system, in a production context. This is distinct from analytics in that it provides information on the workings of the *system* rather than the workings of the *user*. OTEL (opentelemetry) provides a standardized specification for this in the form of *traces* and *metrics*.
- *Fake:* an implementation that provides a functional response, but with in a limited capacity. A fake provider may, for example, provide *Cart* functionality, but only store it in-memory and throw it away on a whim. As such it can be used for prototyping, but never for a production scenario.
- *Product Analytics:* structured analytics that relate to how the the product is being used.
- *Microsite:* an application of a limited scope. It may focus solely on this limited functionality, making it ideal for demonstration purposes.
