[**@reactionary/core**](README.md)

***

[@reactionary/core](README.md) / product.provider

# product.provider

## Classes

### `abstract` ProductProvider

Defined in: [product.provider.ts:7](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/product.provider.ts#L7)

Base capability provider, responsible for mutations (changes) and queries (fetches)
for a given business object domain.

#### Extends

- [`BaseProvider`](base.provider.md#baseprovider)

#### Constructors

##### Constructor

> **new ProductProvider**(`cache`, `context`): [`ProductProvider`](#productprovider)

Defined in: [base.provider.ts:13](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L13)

###### Parameters

###### cache

`Cache`

###### context

`RequestContext`

###### Returns

[`ProductProvider`](#productprovider)

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

##### createEmptyProduct()

> `protected` **createEmptyProduct**(`id`): `Product`

Defined in: [product.provider.ts:44](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/product.provider.ts#L44)

###### Parameters

###### id

`string`

###### Returns

`Product`

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

##### getById()

> `abstract` **getById**(`payload`): `Promise`\<`Result`\<`Product`\>\>

Defined in: [product.provider.ts:20](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/product.provider.ts#L20)

Get a product by its ID.

###### Parameters

###### payload

`ProductQueryById`

The query payload containing the product ID.

###### Returns

`Promise`\<`Result`\<`Product`\>\>

##### getBySKU()

> `abstract` **getBySKU**(`payload`): `Promise`\<`Result`\<`Product`\>\>

Defined in: [product.provider.ts:42](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/product.provider.ts#L42)

Get a product by its SKU

###### Parameters

###### payload

`ProductQueryBySKU`

###### Returns

`Promise`\<`Result`\<`Product`\>\>

##### getBySlug()

> `abstract` **getBySlug**(`payload`): `Promise`\<`Result`\<`Product`, `NotFoundError`\>\>

Defined in: [product.provider.ts:30](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/product.provider.ts#L30)

Get a product by its slug.

###### Parameters

###### payload

`ProductQueryBySlug`

The query payload containing the product slug.

###### Returns

`Promise`\<`Result`\<`Product`, `NotFoundError`\>\>

##### getResourceName()

> `protected` **getResourceName**(): `string`

Defined in: [product.provider.ts:83](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/product.provider.ts#L83)

The resource name, used for caching and logging.

###### Returns

`string`

###### Overrides

[`BaseProvider`](base.provider.md#baseprovider).[`getResourceName`](base.provider.md#getresourcename)
