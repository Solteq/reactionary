[**@reactionary/core**](README.md)

***

[@reactionary/core](README.md) / cart.provider

# cart.provider

## Providers

### `abstract` CartProvider

Defined in: [cart.provider.ts:12](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/cart.provider.ts#L12)

#### Extends

- [`BaseProvider`](base.provider.md#baseprovider)

#### Constructors

##### Constructor

> **new CartProvider**(`cache`, `context`): [`CartProvider`](#cartprovider)

Defined in: [base.provider.ts:13](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L13)

###### Parameters

###### cache

`Cache`

###### context

`RequestContext`

###### Returns

[`CartProvider`](#cartprovider)

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

##### add()

> `abstract` **add**(`payload`): `Promise`\<`Result`\<`Cart`\>\>

Defined in: [cart.provider.ts:42](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/cart.provider.ts#L42)

Add item to cart. If no cart exists, create a new one. Returns the updated and recalculated cart.
Does not automatically consolidate items, so if you want to have second add of same item to increase quantity,
you need to handle that in your logic or on the server.

Usecase: Add item to cart, create cart if none exists.

###### Parameters

###### payload

`CartMutationItemAdd`

###### Returns

`Promise`\<`Result`\<`Cart`\>\>

##### applyCouponCode()

> `abstract` **applyCouponCode**(`payload`): `Promise`\<`Result`\<`Cart`\>\>

Defined in: [cart.provider.ts:81](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/cart.provider.ts#L81)

Applies a coupon code to the cart. Returns the updated and recalculated cart.

Usecase: User applies a coupon code during checkout.

###### Parameters

###### payload

`CartMutationApplyCoupon`

###### Returns

`Promise`\<`Result`\<`Cart`\>\>

##### changeCurrency()

> `abstract` **changeCurrency**(`payload`): `Promise`\<`Result`\<`Cart`\>\>

Defined in: [cart.provider.ts:100](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/cart.provider.ts#L100)

Changes the currency of the cart.

Usecase: User wants to change the currency for his session. This will change the currency of the cart, and recalculate prices.

###### Parameters

###### payload

`CartMutationChangeCurrency`

###### Returns

`Promise`\<`Result`\<`Cart`\>\>

##### changeQuantity()

> `abstract` **changeQuantity**(`payload`): `Promise`\<`Result`\<`Cart`\>\>

Defined in: [cart.provider.ts:62](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/cart.provider.ts#L62)

Change quantity of item in cart. If the cart is empty after change, delete the cart. Returns the updated and recalculated cart.
Changing quantity to 0 is not allowed. Use the remove call instead. This is done to avoid accidental removal of item.
Calls with quantity 0 will just be ignored.

Usecase: Change quantity of item in cart,  like in a minicart, or in the full cart view.

###### Parameters

###### payload

`CartMutationItemQuantityChange`

###### Returns

`Promise`\<`Result`\<`Cart`\>\>

##### deleteCart()

> `abstract` **deleteCart**(`payload`): `Promise`\<`Result`\<`void`\>\>

Defined in: [cart.provider.ts:72](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/cart.provider.ts#L72)

Deletes the entire cart.

Usecase: User wants to empty the cart or something is wrong with the current cart, and you want to clear it out and start fresh.

###### Parameters

###### payload

`CartMutationDeleteCart`

###### Returns

`Promise`\<`Result`\<`void`\>\>

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

##### getActiveCartId()

> `abstract` **getActiveCartId**(): `Promise`\<`Result`\<`CartIdentifier`, `NotFoundError`\>\>

Defined in: [cart.provider.ts:30](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/cart.provider.ts#L30)

Get the active cart id for the user.

Usecase: Most common usecase during site load, or after login. You want to get the active cart for the user, so you can display it in the minicart.

###### Returns

`Promise`\<`Result`\<`CartIdentifier`, `NotFoundError`\>\>

##### getById()

> `abstract` **getById**(`payload`): `Promise`\<`Result`\<`Cart`, `NotFoundError`\>\>

Defined in: [cart.provider.ts:21](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/cart.provider.ts#L21)

Get cart by ID.

Usecase: Unclear, until we support multiple carts per user.

###### Parameters

###### payload

`CartQueryById`

###### Returns

`Promise`\<`Result`\<`Cart`, `NotFoundError`\>\>

##### getResourceName()

> `protected` **getResourceName**(): `string`

Defined in: [cart.provider.ts:102](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/cart.provider.ts#L102)

Returns the abstract resource name provided by the remote system.

###### Returns

`string`

###### Overrides

[`BaseProvider`](base.provider.md#baseprovider).[`getResourceName`](base.provider.md#getresourcename)

##### remove()

> `abstract` **remove**(`payload`): `Promise`\<`Result`\<`Cart`\>\>

Defined in: [cart.provider.ts:51](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/cart.provider.ts#L51)

Remove item from cart. If the cart is empty after removal, delete the cart. Returns the updated and recalculated cart.

Usecase: Remove item from cart, delete cart if empty.

###### Parameters

###### payload

`CartMutationItemRemove`

###### Returns

`Promise`\<`Result`\<`Cart`\>\>

##### removeCouponCode()

> `abstract` **removeCouponCode**(`payload`): `Promise`\<`Result`\<`Cart`\>\>

Defined in: [cart.provider.ts:91](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/cart.provider.ts#L91)

Removes a coupon code from the cart. Returns the updated and recalculated cart.

Usecase: User removes a coupon code during checkout.

###### Parameters

###### payload

`CartMutationRemoveCoupon`

###### Returns

`Promise`\<`Result`\<`Cart`\>\>
