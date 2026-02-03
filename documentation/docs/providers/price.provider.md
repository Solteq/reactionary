[**@reactionary/core**](README.md)

***

[@reactionary/core](README.md) / price.provider

# price.provider

## Classes

### `abstract` PriceProvider

Defined in: [price.provider.ts:8](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/price.provider.ts#L8)

Base capability provider, responsible for mutations (changes) and queries (fetches)
for a given business object domain.

#### Extends

- [`BaseProvider`](base.provider.md#baseprovider)

#### Constructors

##### Constructor

> **new PriceProvider**(`cache`, `context`): [`PriceProvider`](#priceprovider)

Defined in: [base.provider.ts:13](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L13)

###### Parameters

###### cache

`Cache`

###### context

`RequestContext`

###### Returns

[`PriceProvider`](#priceprovider)

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

##### createEmptyPriceResult()

> `protected` **createEmptyPriceResult**(`sku`): `Price`

Defined in: [price.provider.ts:38](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/price.provider.ts#L38)

Utility function to create an empty price result, with a value of -1.
This is used when no price is found for a given SKU + currency combination.
You should check for meta.placeholder to see if this is a real price or a placeholder.

###### Parameters

###### sku

`string`

###### Returns

`Price`

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

##### getCustomerPrice()

> `abstract` **getCustomerPrice**(`payload`): `Promise`\<`Result`\<`Price`\>\>

Defined in: [price.provider.ts:28](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/price.provider.ts#L28)

Get a customer-specific price by SKU.

No

Usecase: You are rendering a product page, and you need to show the price for a SKU.

###### Parameters

###### payload

`CustomerPriceQuery`

The SKU to query

###### Returns

`Promise`\<`Result`\<`Price`\>\>

##### getListPrice()

> `abstract` **getListPrice**(`payload`): `Promise`\<`Result`\<`Price`\>\>

Defined in: [price.provider.ts:17](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/price.provider.ts#L17)

Get a list price price by SKU. This is the most general, undiscounted price and is typically
used as the "before" price in most ecommerce setups.

Usecase: You are rendering a product page, and you need to show the price for a SKU.

###### Parameters

###### payload

`ListPriceQuery`

The SKU to query

###### Returns

`Promise`\<`Result`\<`Price`\>\>

##### getResourceName()

> `protected` **getResourceName**(): `string`

Defined in: [price.provider.ts:55](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/price.provider.ts#L55)

Returns the abstract resource name provided by the remote system.

###### Returns

`string`

###### Overrides

[`BaseProvider`](base.provider.md#baseprovider).[`getResourceName`](base.provider.md#getresourcename)
