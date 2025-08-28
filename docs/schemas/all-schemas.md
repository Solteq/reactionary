# Reactionary Schema Documentation

## Image

_Object containing the following properties:_

| Property | Type             | Default                          |
| :------- | :--------------- | :------------------------------- |
| `url`    | `string` (_url_) | `'https://placehold.co/400x400'` |
| `title`  | `string`         | `'Placeholder image'`            |
| `height` | `number`         | `400`                            |
| `width`  | `number`         | `400`                            |

_All properties are optional._

## Product

_Object containing the following properties:_

| Property      | Type                                                                                                                                                                                                                                                         | Default                                                |
| :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------- |
| `meta`        | _Object with properties:_<ul><li>`cache`: _Object with properties:_<ul><li>`hit`: `boolean`</li><li>`key`: `string`</li></ul></li><li>`placeholder`: `boolean` - Whether or not the entity exists in a remote system, or is a default placeholder.</li></ul> | `{"cache":{"hit":false,"key":""},"placeholder":false}` |
| `identifier`  | _Object with properties:_<ul><li>`key`: `string`</li></ul>                                                                                                                                                                                                   | `{"key":""}`                                           |
| `name`        | `string`                                                                                                                                                                                                                                                     | `''`                                                   |
| `slug`        | `string`                                                                                                                                                                                                                                                     | `''`                                                   |
| `description` | `string`                                                                                                                                                                                                                                                     | `''`                                                   |
| `skus`        | _Array of [SKU](#sku) items_                                                                                                                                                                                                                                 | `[]`                                                   |

_All properties are optional._

## SKU

_Object containing the following properties:_

| Property                  | Type                                                                | Default      |
| :------------------------ | :------------------------------------------------------------------ | :----------- |
| `identifier`              | _Object with properties:_<ul><li>**`key`** (\*): `string`</li></ul> | `{"key":""}` |
| `image`                   | [Image](#image)                                                     |              |
| `images`                  | _Array of [Image](#image) items_                                    | `[]`         |
| `selectionAttributes`     | _Array of [SelectionAttribute](#selectionattribute) items_          | `[]`         |
| `technicalSpecifications` | _Array of [TechnicalSpecification](#technicalspecification) items_  | `[]`         |
| `isHero`                  | `boolean`                                                           | `false`      |

_All properties are optional._

## SelectionAttribute

_Object containing the following properties:_

| Property         | Type     |
| :--------------- | :------- |
| **`id`** (\*)    | `string` |
| **`name`** (\*)  | `string` |
| **`value`** (\*) | `string` |

_(\*) Required._

## TechnicalSpecification

_Object containing the following properties:_

| Property         | Type     |
| :--------------- | :------- |
| **`id`** (\*)    | `string` |
| **`name`** (\*)  | `string` |
| **`value`** (\*) | `string` |

_(\*) Required._

## SearchResultFacet

_Object containing the following properties:_

| Property     | Type                                                                | Default      |
| :----------- | :------------------------------------------------------------------ | :----------- |
| `identifier` | _Object with properties:_<ul><li>**`key`** (\*): `string`</li></ul> | `{"key":""}` |
| `name`       | `string`                                                            | `''`         |
| `values`     | _Array of [SearchResultFacetValue](#searchresultfacetvalue) items_  | `[]`         |

_All properties are optional._

## SearchResultFacetValue

_Object containing the following properties:_

| Property     | Type                                                                                                                                                     | Default                         |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------ |
| `identifier` | _Object with properties:_<ul><li>`facet`: _Object with properties:_<ul><li>**`key`** (\*): `string`</li></ul></li><li>**`key`** (\*): `string`</li></ul> | `{"facet":{"key":""},"key":""}` |
| `name`       | `string`                                                                                                                                                 | `''`                            |
| `count`      | `number`                                                                                                                                                 | `0`                             |
| `active`     | `boolean`                                                                                                                                                | `false`                         |

_All properties are optional._

## SearchResultProduct

_Object containing the following properties:_

| Property     | Type                                                                                                                                              | Default                                                                                       |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------- |
| `identifier` | _Object with properties:_<ul><li>`key`: `string`</li></ul>                                                                                        | `{"key":""}`                                                                                  |
| `name`       | `string`                                                                                                                                          | `''`                                                                                          |
| `image`      | _Object with properties:_<ul><li>`url`: `string` (_url_)</li><li>`title`: `string`</li><li>`height`: `number`</li><li>`width`: `number`</li></ul> | `{"url":"https://placehold.co/400x400","title":"Placeholder image","height":400,"width":400}` |
| `slug`       | `string`                                                                                                                                          | `''`                                                                                          |

_All properties are optional._

## SearchResult

_Object containing the following properties:_

| Property     | Type                                                                                                                                                                                                                                                                                                                                      | Default                                                |
| :----------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------- |
| `meta`       | _Object with properties:_<ul><li>`cache`: _Object with properties:_<ul><li>`hit`: `boolean`</li><li>`key`: `string`</li></ul></li><li>`placeholder`: `boolean` - Whether or not the entity exists in a remote system, or is a default placeholder.</li></ul>                                                                              | `{"cache":{"hit":false,"key":""},"placeholder":false}` |
| `identifier` | _Object with properties:_<ul><li>**`term`** (\*): `string`</li><li>**`page`** (\*): `number`</li><li>**`pageSize`** (\*): `number`</li><li>**`facets`** (\*): _Array of objects:_<br /><ul><li>**`facet`** (\*): _Object with properties:_<ul><li>**`key`** (\*): `string`</li></ul></li><li>**`key`** (\*): `string`</li></ul></li></ul> | `{"term":"","page":0,"pageSize":20,"facets":[]}`       |
| `products`   | _Array of [SearchResultProduct](#searchresultproduct) items_                                                                                                                                                                                                                                                                              | `[]`                                                   |
| `pages`      | `number`                                                                                                                                                                                                                                                                                                                                  | `0`                                                    |
| `facets`     | _Array of [SearchResultFacet](#searchresultfacet) items_                                                                                                                                                                                                                                                                                  | `[]`                                                   |

_All properties are optional._

## CartIdentifier

_Object containing the following properties:_

| Property | Type     | Default |
| :------- | :------- | :------ |
| `key`    | `string` | `''`    |

_All properties are optional._

## CartItemIdentifier

_Object containing the following properties:_

| Property | Type     | Default |
| :------- | :------- | :------ |
| `key`    | `string` | `''`    |

_All properties are optional._

## FacetIdentifier

_Object containing the following properties:_

| Property       | Type     | Default |
| :------------- | :------- | :------ |
| **`key`** (\*) | `string` | `''`    |

_(\*) Required._

## FacetValueIdentifier

_Object containing the following properties:_

| Property       | Type                                | Default |
| :------------- | :---------------------------------- | :------ |
| `facet`        | [FacetIdentifier](#facetidentifier) |         |
| **`key`** (\*) | `string`                            | `''`    |

_(\*) Required._

## PriceIdentifier

_Object containing the following properties:_

| Property | Type                            |
| :------- | :------------------------------ |
| `sku`    | [SKUIdentifier](#skuidentifier) |

_All properties are optional._

## ProductIdentifier

_Object containing the following properties:_

| Property | Type     | Default |
| :------- | :------- | :------ |
| `key`    | `string` | `''`    |

_All properties are optional._

## SKUIdentifier

_Object containing the following properties:_

| Property       | Type     | Default |
| :------------- | :------- | :------ |
| **`key`** (\*) | `string` | `''`    |

_(\*) Required._

## SearchIdentifier

_Object containing the following properties:_

| Property            | Type                                                                                                                                                              | Default |
| :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------ |
| **`term`** (\*)     | `string`                                                                                                                                                          | `''`    |
| **`page`** (\*)     | `number`                                                                                                                                                          | `0`     |
| **`pageSize`** (\*) | `number`                                                                                                                                                          | `20`    |
| **`facets`** (\*)   | _Array of objects:_<br /><ul><li>**`facet`** (\*): _Object with properties:_<ul><li>**`key`** (\*): `string`</li></ul></li><li>**`key`** (\*): `string`</li></ul> | `[]`    |

_(\*) Required._

## CartItem

_Object containing the following properties:_

| Property     | Type                                                       | Default      |
| :----------- | :--------------------------------------------------------- | :----------- |
| `identifier` | _Object with properties:_<ul><li>`key`: `string`</li></ul> | `{"key":""}` |
| `product`    | _Object with properties:_<ul><li>`key`: `string`</li></ul> | `{"key":""}` |
| `quantity`   | `number`                                                   | `0`          |

_All properties are optional._

## Cart

_Object containing the following properties:_

| Property     | Type                                                                                                                                                                                                                                                         | Default                                                |
| :----------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------- |
| `meta`       | _Object with properties:_<ul><li>`cache`: _Object with properties:_<ul><li>`hit`: `boolean`</li><li>`key`: `string`</li></ul></li><li>`placeholder`: `boolean` - Whether or not the entity exists in a remote system, or is a default placeholder.</li></ul> | `{"cache":{"hit":false,"key":""},"placeholder":false}` |
| `identifier` | _Object with properties:_<ul><li>`key`: `string`</li></ul>                                                                                                                                                                                                   | `{"key":""}`                                           |
| `items`      | _Array of [CartItem](#cartitem) items_                                                                                                                                                                                                                       | `[]`                                                   |

_All properties are optional._

## MonetaryAmount

_Object containing the following properties:_

| Property   | Description                                                               | Type                                                                                                                                                                                      | Default |
| :--------- | :------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------ |
| `cents`    | The monetary amount in cent-precision.                                    | `number`                                                                                                                                                                                  | `0`     |
| `currency` | The currency associated with the amount, as a ISO 4217 standardized code. | `'AED' \| 'AFN' \| 'ALL' \| 'AMD' \| 'ANG' \| 'AOA' \| 'ARS' \| 'AUD' \| 'AWG' \| 'AZN' \| 'BAM' \| 'BBD' \| 'BDT' \| 'BGN' \| 'BHD' \| 'BIF' \| 'BMD' \| 'BND' \| 'BOB' \| 'BOV' \| ...` | `'XXX'` |

_All properties are optional._

## Price

_Object containing the following properties:_

| Property     | Type                                                                                                                                                                                                                                                         | Default                                                |
| :----------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------- |
| `meta`       | _Object with properties:_<ul><li>`cache`: _Object with properties:_<ul><li>`hit`: `boolean`</li><li>`key`: `string`</li></ul></li><li>`placeholder`: `boolean` - Whether or not the entity exists in a remote system, or is a default placeholder.</li></ul> | `{"cache":{"hit":false,"key":""},"placeholder":false}` |
| `identifier` | _Object with properties:_<ul><li>`sku`: _Object with properties:_<ul><li>**`key`** (\*): `string`</li></ul></li></ul>                                                                                                                                        | `{"sku":{"key":""}}`                                   |
| `value`      | [MonetaryAmount](#monetaryamount)                                                                                                                                                                                                                            |                                                        |

_All properties are optional._
