# @reactionary/oidc

Shared OpenID Connect relying party for backends that cannot run an external login themselves.

A backend that **hosts** the redirect (for example Medusa) implements `startExternalLogin` and `completeExternalLogin` directly. A backend that does not extends `OidcIdentityCapability` instead: this package runs discovery, authorization code with PKCE, nonce and ID-token validation, and the backend implements one method, `exchangeExternalIdentity`, which turns the verified identity into a backend session.

The storefront sees the same three calls either way: `listProviders`, `startExternalLogin`, `completeExternalLogin`.

## Configuring providers

Backends that use this package take an `externalIdentityProviders` list in their configuration. See `ExternalIdentityProviderSchema`.

## Testing

`@reactionary/oidc/testing` exports a fake identity provider (a local HTTP server with discovery, JWKS, token endpoint and signed ID tokens) and `runExternalLoginConformance`, which every backend's spec should run.

## Building and testing

Run `nx build oidc` and `nx test oidc`.
