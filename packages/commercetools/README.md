# commercetools

This library was generated with [Nx](https://nx.dev).

## Payment custom fields

Payments created by `checkout.addPaymentInstruction` use the
`reactionaryPaymentCustomFields` custom type, which must define:

| Field | Type | Purpose |
| --- | --- | --- |
| `commerceToolsCartId` | String | The checkout (cart) the payment belongs to. |
| `reactionaryProtocolData` | String | The payment's protocol channel, a JSON object exchanged with the payment extensions in both directions. |

`reactionaryProtocolData` is how provider-specific payment data travels
without reactionary knowing the provider:

- **Inbound:** `addPaymentInstruction` writes the instruction's `protocolData`
  into it (only when non-empty) — for example the delegated payment tokens of
  UCP/ACP agents (`delegated_payment_token`, `ucp_payment_credential`).
- **Outbound:** a payment API extension (e.g. the Stripe one) consumes the keys
  it understands, then replaces the content with its results (e.g.
  `stripe_clientSecret`, `stripe_status`), which also removes any token.
- **Reading back:** the checkout factory flattens the JSON object into the
  payment instruction's `protocolData` entries.

## Building

Run `nx build commercetools` to build the library.

## Running unit tests

Run `nx test commercetools` to execute the unit tests via [Vitest](https://vitest.dev/).
