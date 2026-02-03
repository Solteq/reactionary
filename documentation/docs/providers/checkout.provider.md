[**@reactionary/core**](README.md)

***

[@reactionary/core](README.md) / checkout.provider

# checkout.provider

## Classes

### `abstract` CheckoutProvider

Defined in: [checkout.provider.ts:8](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/checkout.provider.ts#L8)

Base capability provider, responsible for mutations (changes) and queries (fetches)
for a given business object domain.

#### Extends

- [`BaseProvider`](base.provider.md#baseprovider)

#### Constructors

##### Constructor

> **new CheckoutProvider**(`cache`, `context`): [`CheckoutProvider`](#checkoutprovider)

Defined in: [base.provider.ts:13](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L13)

###### Parameters

###### cache

`Cache`

###### context

`RequestContext`

###### Returns

[`CheckoutProvider`](#checkoutprovider)

###### Inherited from

[`BaseProvider`](base.provider.md#baseprovider).[`constructor`](base.provider.md#constructor)

#### Properties

##### cache

> `protected` **cache**: `Cache`

Defined in: [base.provider.ts:10](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L10)

###### Inherited from

[`BaseProvider`](base.provider.md#baseprovider).[`cache`](base.provider.md#cache)

##### context

> `protected` **context**: `RequestContext`

Defined in: [base.provider.ts:11](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L11)

###### Inherited from

[`BaseProvider`](base.provider.md#baseprovider).[`context`](base.provider.md#context)

#### Methods

##### addPaymentInstruction()

> `abstract` **addPaymentInstruction**(`payload`): `Promise`\<`Result`\<`Checkout`\>\>

Defined in: [checkout.provider.ts:68](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/checkout.provider.ts#L68)

Adds a payment instruction to the checkout. This will typically create a payment intent in the payment provider, and return whatever is needed to continue the payment process, e.g. a client secret for Stripe, or a redirect URL for PayPal.

Usecase: User has chosen a payment method, and you need to start the payment process.

###### Parameters

###### payload

`CheckoutMutationAddPaymentInstruction`

###### Returns

`Promise`\<`Result`\<`Checkout`\>\>

##### finalizeCheckout()

> `abstract` **finalizeCheckout**(`payload`): `Promise`\<`Result`\<`Checkout`\>\>

Defined in: [checkout.provider.ts:100](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/checkout.provider.ts#L100)

Finalizes the checkout process. This typically involves creating an order from the checkout and processing payment.

Usecase: User has completed all necessary steps in the checkout process and is ready to place the order.

###### Parameters

###### payload

`CheckoutMutationFinalizeCheckout`

###### Returns

`Promise`\<`Result`\<`Checkout`\>\>

##### generateCacheKeyForQuery()

> `protected` **generateCacheKeyForQuery**(`scope`, `query`): `string`

Defined in: [base.provider.ts:32](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L32)

###### Parameters

###### scope

`string`

###### query

`object`

###### Returns

`string`

###### Inherited from

[`BaseProvider`](base.provider.md#baseprovider).[`generateCacheKeyForQuery`](base.provider.md#generatecachekeyforquery)

##### generateDependencyIdsForModel()

> **generateDependencyIdsForModel**(`model`): `string`[]

Defined in: [base.provider.ts:18](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L18)

###### Parameters

###### model

`unknown`

###### Returns

`string`[]

###### Inherited from

[`BaseProvider`](base.provider.md#baseprovider).[`generateDependencyIdsForModel`](base.provider.md#generatedependencyidsformodel)

##### getAvailablePaymentMethods()

> `abstract` **getAvailablePaymentMethods**(`payload`): `Promise`\<`Result`\<`PaymentMethod`[]\>\>

Defined in: [checkout.provider.ts:60](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/checkout.provider.ts#L60)

Returns all available payment methods for the given checkout. This will typically depend mostly on the billing address and jurisdiction.

Usecase: User has chosen shipping method, and you need to show available payment methods.

###### Parameters

###### payload

`CheckoutQueryForAvailablePaymentMethods`

###### Returns

`Promise`\<`Result`\<`PaymentMethod`[]\>\>

##### getAvailableShippingMethods()

> `abstract` **getAvailableShippingMethods**(`payload`): `Promise`\<`Result`\<`ShippingMethod`[]\>\>

Defined in: [checkout.provider.ts:50](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/checkout.provider.ts#L50)

Returns all available shipping methods for the given checkout. This will typically depend on the shipping address, and possibly also the items in the checkout.

Usecase: User has filled out shipping address, and you need to show available shipping methods.

###### Parameters

###### payload

`CheckoutQueryForAvailableShippingMethods`

###### Returns

`Promise`\<`Result`\<`ShippingMethod`[]\>\>

##### getById()

> `abstract` **getById**(`payload`): `Promise`\<`Result`\<`Checkout`, `NotFoundError`\>\>

Defined in: [checkout.provider.ts:30](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/checkout.provider.ts#L30)

Fetches an existing checkout by its identifier.

Usecase: User has navigated to the checkout page, or reloaded on it , or has been redirected back from the payment provider.

###### Parameters

###### payload

`CheckoutQueryById`

###### Returns

`Promise`\<`Result`\<`Checkout`, `NotFoundError`\>\>

##### getResourceName()

> **getResourceName**(): `string`

Defined in: [checkout.provider.ts:103](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/checkout.provider.ts#L103)

Returns the abstract resource name provided by the remote system.

###### Returns

`string`

###### Overrides

[`BaseProvider`](base.provider.md#baseprovider).[`getResourceName`](base.provider.md#getresourcename)

##### initiateCheckoutForCart()

> `abstract` **initiateCheckoutForCart**(`payload`): `Promise`\<`Result`\<`Checkout`\>\>

Defined in: [checkout.provider.ts:20](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/checkout.provider.ts#L20)

This starts a new checkout session for the given cart. The checkout might duplicate the cart, or just reference it, depending on implementation, but changes to the cart,
is not reflected in the checkout, and vice versa. The checkout is a snapshot of the cart at the time of initiation.
The checkout will typically copy over addresses from the user profile, if available, or from the anonymous profile in the session.

Usecase: User has filled out cart, and is ready to checkout. You call this to create a checkout object, that you can then use to set shipping method, payment method etc.

###### Parameters

###### payload

`CheckoutMutationInitiateCheckout`

###### Returns

`Promise`\<`Result`\<`Checkout`\>\>

##### removePaymentInstruction()

> `abstract` **removePaymentInstruction**(`payload`): `Promise`\<`Result`\<`Checkout`\>\>

Defined in: [checkout.provider.ts:76](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/checkout.provider.ts#L76)

Removes a payment instruction from the checkout. This will typically void the payment intent in the payment provider, and remove the payment instruction from the checkout.

Usecase: User has decided to change payment method, or has cancelled the payment process.

###### Parameters

###### payload

`CheckoutMutationRemovePaymentInstruction`

###### Returns

`Promise`\<`Result`\<`Checkout`\>\>

##### setShippingAddress()

> `abstract` **setShippingAddress**(`payload`): `Promise`\<`Result`\<`Checkout`\>\>

Defined in: [checkout.provider.ts:40](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/checkout.provider.ts#L40)

Updates the shipping address for the checkout and recalculates the shipping methods and totals.

Usecase: User has chosen home delivery and you have allowed them to change the address on the checkout page.

NOTE: Unsure this is really needed.

###### Parameters

###### payload

`CheckoutMutationSetShippingAddress`

###### Returns

`Promise`\<`Result`\<`Checkout`\>\>

##### setShippingInstruction()

> `abstract` **setShippingInstruction**(`payload`): `Promise`\<`Result`\<`Checkout`\>\>

Defined in: [checkout.provider.ts:90](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/checkout.provider.ts#L90)

Sets the shipping method and optional pickup point for the checkout. The pickup point can be a physical store, a locker, or similar.
If it is unset, it means home delivery to the shipping address.

Usecase: record all the users shipping choices, and any special instructions they may have added.

###### Parameters

###### payload

`CheckoutMutationSetShippingInstruction`

###### Returns

`Promise`\<`Result`\<`Checkout`\>\>
