[**@reactionary/core**](README.md)

***

[@reactionary/core](README.md) / base.provider

# base.provider

## Classes

### `abstract` BaseProvider

Defined in: [base.provider.ts:9](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L9)

Base capability provider, responsible for mutations (changes) and queries (fetches)
for a given business object domain.

#### Extended by

- [`AnalyticsProvider`](analytics.provider.md#analyticsprovider)
- [`CartProvider`](cart.provider.md#cartprovider)
- [`CategoryProvider`](category.provider.md#categoryprovider)
- [`CheckoutProvider`](checkout.provider.md#checkoutprovider)
- [`IdentityProvider`](identity.provider.md#identityprovider)
- [`InventoryProvider`](inventory.provider.md#inventoryprovider)
- [`OrderSearchProvider`](order-search.provider.md#ordersearchprovider)
- [`OrderProvider`](order.provider.md#orderprovider)
- [`PriceProvider`](price.provider.md#priceprovider)
- [`ProductSearchProvider`](product-search.provider.md#productsearchprovider)
- [`ProductProvider`](product.provider.md#productprovider)
- [`ProfileProvider`](profile.provider.md#profileprovider)
- [`StoreProvider`](store.provider.md#storeprovider)

#### Constructors

##### Constructor

> **new BaseProvider**(`cache`, `context`): [`BaseProvider`](#baseprovider)

Defined in: [base.provider.ts:13](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L13)

###### Parameters

###### cache

`Cache`

###### context

`RequestContext`

###### Returns

[`BaseProvider`](#baseprovider)

#### Properties

##### cache

> `protected` **cache**: `Cache`

Defined in: [base.provider.ts:10](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L10)

##### context

> `protected` **context**: `RequestContext`

Defined in: [base.provider.ts:11](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L11)

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

##### generateDependencyIdsForModel()

> **generateDependencyIdsForModel**(`model`): `string`[]

Defined in: [base.provider.ts:18](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L18)

###### Parameters

###### model

`unknown`

###### Returns

`string`[]

##### getResourceName()

> `abstract` `protected` **getResourceName**(): `string`

Defined in: [base.provider.ts:46](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L46)

Returns the abstract resource name provided by the remote system.

###### Returns

`string`
