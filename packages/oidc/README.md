# @reactionary/oidc

Shared OpenID Connect relying party for backends that cannot run an external login themselves.

A backend that **hosts** the redirect (for example Medusa) implements `startExternalLogin` and `completeExternalLogin` directly. A backend that does not extends `OidcIdentityCapability` instead: this package runs discovery, authorization code with PKCE, nonce and ID-token validation, and the backend implements one method, `exchangeExternalIdentity`, which turns the verified identity into a backend session.

The storefront sees the same three calls either way: `listProviders`, `startExternalLogin`, `completeExternalLogin`.

## Configuring providers

Backends that use this package take an `externalIdentityProviders` list in their configuration. See `ExternalIdentityProviderSchema`.

Two settings matter when moving to another identity provider:

- `tokenEndpointAuthMethod`: how the client authenticates at the token endpoint. By default it is `client_secret_post`, unless the provider's discovery document lists methods and not that one, then `client_secret_basic`. Set it explicitly for providers whose discovery document is wrong or missing.
- `userinfo` (`never`, `when-missing` (default) or `always`): claims the ID token lacks (email, name, `email_verified`) are filled from the userinfo endpoint. ID token claims win, and a userinfo answer for another subject is ignored. `userinfoEndpoint` is only needed when discovery is skipped.

`profileFromOidcClaims` in `@reactionary/core` reads the standard claims (names, phone, address) the same way for every backend.

## Testing

`@reactionary/oidc/testing` exports a fake identity provider (a local HTTP server with discovery, JWKS, token endpoint and signed ID tokens) and `runExternalLoginConformance`, which every backend's spec should run.

## Building and testing

Run `nx build oidc` and `nx test oidc`.
