[**@reactionary/core**](README.md)

***

[@reactionary/core](README.md) / order-search.provider

# order-search.provider

## Classes

### `abstract` OrderSearchProvider

Defined in: [order-search.provider.ts:12](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/order-search.provider.ts#L12)

This provider handles order search operations. In some situations you may have different providers for order history listing and detail retrieval.
The order search is primarily focused on searching and listing orders based on various criteria, and returns only summary information about each order.

Usecase: An e-commerce platform wants to provide customers with a way to search through their past orders using filters like date range, order status, or total amount spent.

#### Extends

- [`BaseProvider`](base.provider.md#baseprovider)

#### Constructors

##### Constructor

> **new OrderSearchProvider**(`cache`, `context`): [`OrderSearchProvider`](#ordersearchprovider)

Defined in: [base.provider.ts:13](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L13)

###### Parameters

###### cache

`Cache`

###### context

`RequestContext`

###### Returns

[`OrderSearchProvider`](#ordersearchprovider)

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

##### getResourceName()

> `protected` **getResourceName**(): `string`

Defined in: [order-search.provider.ts:13](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/order-search.provider.ts#L13)

Returns the abstract resource name provided by the remote system.

###### Returns

`string`

###### Overrides

[`BaseProvider`](base.provider.md#baseprovider).[`getResourceName`](base.provider.md#getresourcename)

##### queryByTerm()

> `abstract` **queryByTerm**(`payload`): `Promise`\<`Result`\<`OrderSearchResult`\>\>

Defined in: [order-search.provider.ts:24](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/order-search.provider.ts#L24)

Queries orders based on the provided search criteria.

Usecase: A customer is in the My Account section, and wants to search for orders placed within the last month that are marked as "shipped".
Usecase: A widget on the frontpage after login, shows the last 5 orders placed by the customer.

###### Parameters

###### payload

`OrderSearchQueryByTerm`

The search criteria for querying orders.

###### Returns

`Promise`\<`Result`\<`OrderSearchResult`\>\>
