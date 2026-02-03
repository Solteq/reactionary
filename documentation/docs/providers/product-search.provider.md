[**@reactionary/core**](README.md)

***

[@reactionary/core](README.md) / product-search.provider

# product-search.provider

## Classes

### `abstract` ProductSearchProvider

Defined in: [product-search.provider.ts:6](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/product-search.provider.ts#L6)

Base capability provider, responsible for mutations (changes) and queries (fetches)
for a given business object domain.

#### Extends

- [`BaseProvider`](base.provider.md#baseprovider)

#### Constructors

##### Constructor

> **new ProductSearchProvider**(`cache`, `context`): [`ProductSearchProvider`](#productsearchprovider)

Defined in: [base.provider.ts:13](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L13)

###### Parameters

###### cache

`Cache`

###### context

`RequestContext`

###### Returns

[`ProductSearchProvider`](#productsearchprovider)

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

##### createCategoryNavigationFilter()

> `abstract` **createCategoryNavigationFilter**(`payload`): `Promise`\<`Result`\<`FacetValueIdentifier`\>\>

Defined in: [product-search.provider.ts:32](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/product-search.provider.ts#L32)

Since each platform has it own way of representing categories and their hierarchy, we leave it to the platform to tell us how to get from a
category breadcrumb path to a global category navigation filter that can be applied to product searches.

So, the CLP pattern would be

const c: Category = await categoryProvider.getBySlug({ slug: 'some-category' });
const breadcrumbPath: Category[] = await categoryProvider.getBreadcrumbPathToCategory({ id: c.identifier });
const categoryFilter: FacetValueIdentifier = categoryNavigationProvider.createCategoryNavigationFilterBreadcrumbs(breadcrumbPath);
const searchResult: ProductSearchResult = await productSearchProvider.queryByTerm({ term: 'some search', facets: [], categoryFilter: [categoryFilter], ... });

from here, you would maybe get facets back with subcategories, but those are relative to the current category filter you have applied, so you
do not need any special handling for that.

Usecase: You are rendering a category page and you want to run a product search to find everything in that category (or below).

###### Parameters

###### payload

`ProductSearchQueryCreateNavigationFilter`

###### Returns

`Promise`\<`Result`\<`FacetValueIdentifier`\>\>

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

Defined in: [product-search.provider.ts:7](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/product-search.provider.ts#L7)

Returns the abstract resource name provided by the remote system.

###### Returns

`string`

###### Overrides

[`BaseProvider`](base.provider.md#baseprovider).[`getResourceName`](base.provider.md#getresourcename)

##### parseFacet()

> `abstract` `protected` **parseFacet**(`facetIdentifier`, `facetValue`): `ProductSearchResultFacet`

Defined in: [product-search.provider.ts:49](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/product-search.provider.ts#L49)

Parses a facet from the search response.

###### Parameters

###### facetIdentifier

`FacetIdentifier`

The identifier for the facet.

###### facetValue

`unknown`

The value for the facet.

Usecase: Override this to customize the parsing of facets.

###### Returns

`ProductSearchResultFacet`

##### parseFacetValue()

> `abstract` `protected` **parseFacetValue**(`facetValueIdentifier`, `label`, `count`): `ProductSearchResultFacetValue`

Defined in: [product-search.provider.ts:40](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/product-search.provider.ts#L40)

Parses a facet value from the search response.

###### Parameters

###### facetValueIdentifier

`FacetValueIdentifier`

The identifier for the facet value.

###### label

`string`

The label for the facet value.

###### count

`number`

The count for the facet value.

###### Returns

`ProductSearchResultFacetValue`

##### parseVariant()

> `abstract` `protected` **parseVariant**(`variant`, `product`): `ProductSearchResultItemVariant`

Defined in: [product-search.provider.ts:58](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/product-search.provider.ts#L58)

Parses a product variant from the search response.

###### Parameters

###### variant

`unknown`

The variant data from the search response.

###### product

`unknown`

The product data from the search response.

Usecase: Override this to customize the parsing of product variants.

###### Returns

`ProductSearchResultItemVariant`

##### queryByTerm()

> `abstract` **queryByTerm**(`payload`): `Promise`\<`Result`\<`ProductSearchResult`\>\>

Defined in: [product-search.provider.ts:11](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/product-search.provider.ts#L11)

###### Parameters

###### payload

`ProductSearchQueryByTerm`

###### Returns

`Promise`\<`Result`\<`ProductSearchResult`\>\>
