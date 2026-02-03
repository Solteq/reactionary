[**@reactionary/core**](README.md)

***

[@reactionary/core](README.md) / category.provider

# category.provider

## Foo

### `abstract` CategoryProvider

Defined in: [category.provider.ts:16](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/category.provider.ts#L16)

CategoryProvider

This provider allows fetching of single or sets of categories.

We only allow fetching one hierachy level at a time, for now. This is to avoid development patterns of "fetch 5000 categories in one go.."

#### Extends

- [`BaseProvider`](base.provider.md#baseprovider)

#### Constructors

##### Constructor

> **new CategoryProvider**(`cache`, `context`): [`CategoryProvider`](#categoryprovider)

Defined in: [base.provider.ts:13](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L13)

###### Parameters

###### cache

`Cache`

###### context

`RequestContext`

###### Returns

[`CategoryProvider`](#categoryprovider)

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

##### findChildCategories()

> `abstract` **findChildCategories**(`payload`): `Promise`\<`Result`\<`CategoryPaginatedResult`\>\>

Defined in: [category.provider.ts:66](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/category.provider.ts#L66)

Finds all child categories of a given category.

Usecase: You are rendering a top menu, or mega menu, and you need the show the child categories of a given category.

NOTE: it is recommended to create a navigational service, that allows combining CMS and Static pages into this, rather than fetching categories directly.

###### Parameters

###### payload

`CategoryQueryForChildCategories`

###### Returns

`Promise`\<`Result`\<`CategoryPaginatedResult`\>\>

##### findTopCategories()

> `abstract` **findTopCategories**(`payload`): `Promise`\<`Result`\<`CategoryPaginatedResult`\>\>

Defined in: [category.provider.ts:75](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/category.provider.ts#L75)

Returns all top categories, i.e. categories without a parent.

Usecase: You are rendering a top menu, or mega menu, and you need the show the top level categories.

###### Parameters

###### payload

`CategoryQueryForTopCategories`

###### Returns

`Promise`\<`Result`\<`CategoryPaginatedResult`\>\>

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

##### getBreadcrumbPathToCategory()

> `abstract` **getBreadcrumbPathToCategory**(`payload`): `Promise`\<`Result`\<`Category`[]\>\>

Defined in: [category.provider.ts:51](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/category.provider.ts#L51)

Gets the breadcrumb path to the category, i.e. all parents up to the root.
The returned order is from root to leaf.

Usecase: You are rendering a category or product page, and you need to show the breadcrumb path.

###### Parameters

###### payload

`CategoryQueryForBreadcrumb`

###### Returns

`Promise`\<`Result`\<`Category`[]\>\>

##### getById()

> `abstract` **getById**(`payload`): `Promise`\<`Result`\<`Category`, `NotFoundError`\>\>

Defined in: [category.provider.ts:32](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/category.provider.ts#L32)

Get a single category by its ID. Cannot return null, because HOW did you come across a categories ID that does not exist?

DISCUSSION: What do you persist in, say, a CMS or Recommendation engine? The seo slug or the ID?
We have previous discussed, that the ID is not necessarily the DATABASE id, but rather an externally unique identifier for the category.

So, if you persist that externally, you could actually end up with an ID that does not exist in the current system.

For now, the result will be en empty category, but we should probably throw an error instead.

Use case: You have received a list of category ids from a recommendation engine, and you need to show a tile of this.
Future optimization: getByIds(ids: CategoryIdentifier[], reqCtx: RequestContext): Promise<T[]>

###### Parameters

###### payload

`CategoryQueryById`

###### Returns

`Promise`\<`Result`\<`Category`, `NotFoundError`\>\>

##### getBySlug()

> `abstract` **getBySlug**(`payload`): `Promise`\<`Result`\<`Category`, `NotFoundError`\>\>

Defined in: [category.provider.ts:41](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/category.provider.ts#L41)

Gets a single category by its seo slug

Usecase: You are rendering a category page, and you have the slug from the URL.

###### Parameters

###### payload

`CategoryQueryBySlug`

###### Returns

`Promise`\<`Result`\<`Category`, `NotFoundError`\>\>

##### getResourceName()

> `protected` **getResourceName**(): `string`

Defined in: [category.provider.ts:78](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/category.provider.ts#L78)

Returns the abstract resource name provided by the remote system.

###### Returns

`string`

###### Overrides

[`BaseProvider`](base.provider.md#baseprovider).[`getResourceName`](base.provider.md#getresourcename)
