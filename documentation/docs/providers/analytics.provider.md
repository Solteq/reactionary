[**@reactionary/core**](README.md)

***

[@reactionary/core](README.md) / analytics.provider

# analytics.provider

## Providers

### `abstract` AnalyticsProvider

Defined in: [analytics.provider.ts:10](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/analytics.provider.ts#L10)

#### Extends

- [`BaseProvider`](base.provider.md#baseprovider)

#### Extended by

- [`MulticastAnalyticsProvider`](#multicastanalyticsprovider)

#### Constructors

##### Constructor

> **new AnalyticsProvider**(`cache`, `context`): [`AnalyticsProvider`](#analyticsprovider)

Defined in: [base.provider.ts:13](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L13)

###### Parameters

###### cache

`Cache`

###### context

`RequestContext`

###### Returns

[`AnalyticsProvider`](#analyticsprovider)

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

Defined in: [analytics.provider.ts:11](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/analytics.provider.ts#L11)

Returns the abstract resource name provided by the remote system.

###### Returns

`string`

###### Overrides

[`BaseProvider`](base.provider.md#baseprovider).[`getResourceName`](base.provider.md#getresourcename)

##### track()

> `abstract` **track**(`event`): `Promise`\<`void`\>

Defined in: [analytics.provider.ts:15](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/analytics.provider.ts#L15)

###### Parameters

###### event

`AnalyticsMutation`

###### Returns

`Promise`\<`void`\>

***

### MulticastAnalyticsProvider

Defined in: [analytics.provider.ts:18](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/analytics.provider.ts#L18)

#### Extends

- [`AnalyticsProvider`](#analyticsprovider)

#### Constructors

##### Constructor

> **new MulticastAnalyticsProvider**(`cache`, `requestContext`, `providers`): [`MulticastAnalyticsProvider`](#multicastanalyticsprovider)

Defined in: [analytics.provider.ts:21](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/analytics.provider.ts#L21)

###### Parameters

###### cache

`Cache`

###### requestContext

`RequestContext`

###### providers

[`AnalyticsProvider`](#analyticsprovider)[]

###### Returns

[`MulticastAnalyticsProvider`](#multicastanalyticsprovider)

###### Overrides

[`AnalyticsProvider`](#analyticsprovider).[`constructor`](#constructor)

#### Properties

##### cache

> `protected` **cache**: `Cache`

Defined in: [base.provider.ts:10](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L10)

###### Inherited from

[`AnalyticsProvider`](#analyticsprovider).[`cache`](#cache)

##### context

> `protected` **context**: `RequestContext`

Defined in: [base.provider.ts:11](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L11)

###### Inherited from

[`AnalyticsProvider`](#analyticsprovider).[`context`](#context)

##### providers

> `protected` **providers**: [`AnalyticsProvider`](#analyticsprovider)[]

Defined in: [analytics.provider.ts:19](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/analytics.provider.ts#L19)

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

[`AnalyticsProvider`](#analyticsprovider).[`generateCacheKeyForQuery`](#generatecachekeyforquery)

##### generateDependencyIdsForModel()

> **generateDependencyIdsForModel**(`model`): `string`[]

Defined in: [base.provider.ts:18](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L18)

###### Parameters

###### model

`unknown`

###### Returns

`string`[]

###### Inherited from

[`AnalyticsProvider`](#analyticsprovider).[`generateDependencyIdsForModel`](#generatedependencyidsformodel)

##### getResourceName()

> `protected` **getResourceName**(): `string`

Defined in: [analytics.provider.ts:11](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/analytics.provider.ts#L11)

Returns the abstract resource name provided by the remote system.

###### Returns

`string`

###### Inherited from

[`AnalyticsProvider`](#analyticsprovider).[`getResourceName`](#getresourcename)

##### track()

> **track**(`event`): `Promise`\<`void`\>

Defined in: [analytics.provider.ts:30](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/analytics.provider.ts#L30)

###### Parameters

###### event

`AnalyticsMutation`

###### Returns

`Promise`\<`void`\>

###### Overrides

[`AnalyticsProvider`](#analyticsprovider).[`track`](#track)
