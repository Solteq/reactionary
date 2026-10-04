# commercetools

This library was generated with [Nx](https://nx.dev).

## Payment custom fields

Payments created by `checkout.addPaymentInstruction` use the
`reactionaryPaymentCustomFields` custom type, which must define:

| Field | Type | Purpose |
| --- | --- | --- |
| `commerceToolsCartId` | String | The checkout (cart) the payment belongs to. |
| `reactionaryProtocolData` | String | The payment instruction's `protocolData` as a JSON object, written only when it is non-empty. |

`reactionaryProtocolData` is how provider-specific payment data reaches the
project's payment integration without reactionary knowing the provider — for
example the delegated payment tokens of UCP/ACP agents
(`delegated_payment_token`, `ucp_payment_credential`). A payment API extension
(e.g. the Stripe one) reads the keys it understands, ignores the rest, and
should clear the field once used so no tokens are stored on the payment.

## Building

Run `nx build commercetools` to build the library.

## Running unit tests

Run `nx test commercetools` to execute the unit tests via [Vitest](https://vitest.dev/).
