# Reactionary Schema Documentation

## AnalyticsEvent

Analytics event for tracking user interactions and behaviors

_Object containing the following properties:_

| Property | Description       | Type          |
| :------- | :---------------- | :------------ |
| `meta`   | Response metadata | [Meta](#meta) |

_All properties are optional._

## BaseModel

Base schema that all models extend from

_Object containing the following properties:_

| Property | Description       | Type          |
| :------- | :---------------- | :------------ |
| `meta`   | Response metadata | [Meta](#meta) |

_All properties are optional._

## CacheInformation

Metadata about cache usage for the response

_Object containing the following properties:_

| Property | Description                                | Type      | Default |
| :------- | :----------------------------------------- | :-------- | :------ |
| `hit`    | Whether this data was retrieved from cache | `boolean` | `false` |
| `key`    | The cache key used for this data           | `string`  | `''`    |

_All properties are optional._

## Capabilities

_Object containing the following properties:_

| Property             | Type      |
| :------------------- | :-------- |
| **`product`** (\*)   | `boolean` |
| **`search`** (\*)    | `boolean` |
| **`analytics`** (\*) | `boolean` |
| **`identity`** (\*)  | `boolean` |
| **`cart`** (\*)      | `boolean` |
| **`inventory`** (\*) | `boolean` |
| **`price`** (\*)     | `boolean` |

_(\*) Required._

## CartIdentifier

Identifies a shopping cart or basket

_Object containing the following properties:_

| Property | Description                          | Type     | Default |
| :------- | :----------------------------------- | :------- | :------ |
| `key`    | Unique cart identifier or session ID | `string` | `''`    |

_All properties are optional._

## CartItemIdentifier

Identifies a specific item within a shopping cart

_Object containing the following properties:_

| Property | Description                                   | Type     | Default |
| :------- | :-------------------------------------------- | :------- | :------ |
| `key`    | Unique identifier for a line item in the cart | `string` | `''`    |

_All properties are optional._

## CartItem

A single line item in a shopping cart

_Object containing the following properties:_

| Property     | Description                                | Type                                      | Default |
| :----------- | :----------------------------------------- | :---------------------------------------- | :------ |
| `identifier` | Unique identifier for this cart line item  | [CartItemIdentifier](#cartitemidentifier) |         |
| `product`    | Reference to the product in this line item | [ProductIdentifier](#productidentifier)   |         |
| `quantity`   | Quantity of the product in the cart        | `number`                                  | `0`     |

_All properties are optional._

## Cart

Shopping cart containing products and quantities

_Object containing the following properties:_

| Property     | Description                     | Type                                   | Default |
| :----------- | :------------------------------ | :------------------------------------- | :------ |
| `meta`       | Response metadata               | [Meta](#meta)                          |         |
| `identifier` | Unique identifier for this cart | [CartIdentifier](#cartidentifier)      |         |
| `items`      | List of items in the cart       | _Array of [CartItem](#cartitem) items_ | `[]`    |

_All properties are optional._

## Currency

ISO 4217 currency codes

_Enum, one of the following possible values:_

<details>
<summary><i>Expand for full list of 181 values</i></summary>

- `'AED'`
- `'AFN'`
- `'ALL'`
- `'AMD'`
- `'ANG'`
- `'AOA'`
- `'ARS'`
- `'AUD'`
- `'AWG'`
- `'AZN'`
- `'BAM'`
- `'BBD'`
- `'BDT'`
- `'BGN'`
- `'BHD'`
- `'BIF'`
- `'BMD'`
- `'BND'`
- `'BOB'`
- `'BOV'`
- `'BRL'`
- `'BSD'`
- `'BTN'`
- `'BWP'`
- `'BYN'`
- `'BZD'`
- `'CAD'`
- `'CDF'`
- `'CHE'`
- `'CHF'`
- `'CHW'`
- `'CLF'`
- `'CLP'`
- `'CNY'`
- `'COP'`
- `'COU'`
- `'CRC'`
- `'CUC'`
- `'CUP'`
- `'CVE'`
- `'CZK'`
- `'DJF'`
- `'DKK'`
- `'DOP'`
- `'DZD'`
- `'EGP'`
- `'ERN'`
- `'ETB'`
- `'EUR'`
- `'FJD'`
- `'FKP'`
- `'GBP'`
- `'GEL'`
- `'GHS'`
- `'GIP'`
- `'GMD'`
- `'GNF'`
- `'GTQ'`
- `'GYD'`
- `'HKD'`
- `'HNL'`
- `'HRK'`
- `'HTG'`
- `'HUF'`
- `'IDR'`
- `'ILS'`
- `'INR'`
- `'IQD'`
- `'IRR'`
- `'ISK'`
- `'JMD'`
- `'JOD'`
- `'JPY'`
- `'KES'`
- `'KGS'`
- `'KHR'`
- `'KMF'`
- `'KPW'`
- `'KRW'`
- `'KWD'`
- `'KYD'`
- `'KZT'`
- `'LAK'`
- `'LBP'`
- `'LKR'`
- `'LRD'`
- `'LSL'`
- `'LYD'`
- `'MAD'`
- `'MDL'`
- `'MGA'`
- `'MKD'`
- `'MMK'`
- `'MNT'`
- `'MOP'`
- `'MRU'`
- `'MUR'`
- `'MVR'`
- `'MWK'`
- `'MXN'`
- `'MXV'`
- `'MYR'`
- `'MZN'`
- `'NAD'`
- `'NGN'`
- `'NIO'`
- `'NOK'`
- `'NPR'`
- `'NZD'`
- `'OMR'`
- `'PAB'`
- `'PEN'`
- `'PGK'`
- `'PHP'`
- `'PKR'`
- `'PLN'`
- `'PYG'`
- `'QAR'`
- `'RON'`
- `'RSD'`
- `'RUB'`
- `'RWF'`
- `'SAR'`
- `'SBD'`
- `'SCR'`
- `'SDG'`
- `'SEK'`
- `'SGD'`
- `'SHP'`
- `'SLE'`
- `'SLL'`
- `'SOS'`
- `'SRD'`
- `'SSP'`
- `'STN'`
- `'SYP'`
- `'SZL'`
- `'THB'`
- `'TJS'`
- `'TMT'`
- `'TND'`
- `'TOP'`
- `'TRY'`
- `'TTD'`
- `'TVD'`
- `'TWD'`
- `'TZS'`
- `'UAH'`
- `'UGX'`
- `'USD'`
- `'USN'`
- `'UYI'`
- `'UYU'`
- `'UYW'`
- `'UZS'`
- `'VED'`
- `'VES'`
- `'VND'`
- `'VUV'`
- `'WST'`
- `'XAF'`
- `'XAG'`
- `'XAU'`
- `'XBA'`
- `'XBB'`
- `'XBC'`
- `'XBD'`
- `'XCD'`
- `'XDR'`
- `'XOF'`
- `'XPD'`
- `'XPF'`
- `'XPT'`
- `'XSU'`
- `'XTS'`
- `'XUA'`
- `'XXX'`
- `'YER'`
- `'ZAR'`
- `'ZMW'`
- `'ZWL'`

</details>

## FacetIdentifier

Identifies a search facet used for filtering results

_Object containing the following properties:_

| Property       | Description                                                  | Type     | Default |
| :------------- | :----------------------------------------------------------- | :------- | :------ |
| **`key`** (\*) | Unique key identifying the facet (e.g., "brand", "category") | `string` | `''`    |

_(\*) Required._

## FacetValueIdentifier

Identifies a specific value within a search facet

_Object containing the following properties:_

| Property       | Description                                                   | Type                                | Default |
| :------------- | :------------------------------------------------------------ | :---------------------------------- | :------ |
| `facet`        | The parent facet this value belongs to                        | [FacetIdentifier](#facetidentifier) |         |
| **`key`** (\*) | Unique key for this facet value (e.g., "nike", "electronics") | `string`                            | `''`    |

_(\*) Required._

## Identity

User identity and authentication information

_Object containing the following properties:_

| Property | Description                          | Type                          | Default                      |
| :------- | :----------------------------------- | :---------------------------- | :--------------------------- |
| `meta`   | Response metadata                    | [Meta](#meta)                 |                              |
| `id`     | Unique identifier for the user       | `string`                      | `''`                         |
| `type`   | The type of user account             | [IdentityType](#identitytype) |                              |
| `token`  | Authentication token for the session | `string`                      |                              |
| `issued` | When the identity/token was issued   | `Date`                        | `"2025-08-27T07:08:01.223Z"` |
| `expiry` | When the identity/token expires      | `Date`                        | `"2025-08-27T07:08:01.223Z"` |

_All properties are optional._

## IdentityType

Type of user identity

_Enum, one of the following possible values:_

- `'Anonymous'`
- `'Guest'`
- `'Registered'`

## Image

Represents an image asset with dimensions and metadata

_Object containing the following properties:_

| Property | Description                     | Type             | Default                          |
| :------- | :------------------------------ | :--------------- | :------------------------------- |
| `url`    | The URL of the image            | `string` (_url_) | `'https://placehold.co/400x400'` |
| `title`  | Alt text or title for the image | `string`         | `'Placeholder image'`            |
| `height` | Height of the image in pixels   | `number`         | `400`                            |
| `width`  | Width of the image in pixels    | `number`         | `400`                            |

_All properties are optional._

## Inventory

Inventory information for a product or SKU

_Object containing the following properties:_

| Property   | Description              | Type          | Default |
| :--------- | :----------------------- | :------------ | :------ |
| `meta`     | Response metadata        | [Meta](#meta) |         |
| `quantity` | Available stock quantity | `number`      | `0`     |

_All properties are optional._

## Meta

Metadata about the response and data source

_Object containing the following properties:_

| Property      | Description                                                                       | Type                                  | Default |
| :------------ | :-------------------------------------------------------------------------------- | :------------------------------------ | :------ |
| `cache`       | Cache information for this response                                               | [CacheInformation](#cacheinformation) |         |
| `placeholder` | Whether or not the entity exists in a remote system, or is a default placeholder. | `boolean`                             | `false` |

_All properties are optional._

## MonetaryAmount

Represents a monetary value with currency and precision

_Object containing the following properties:_

| Property   | Description                                                               | Type                  | Default |
| :--------- | :------------------------------------------------------------------------ | :-------------------- | :------ |
| `cents`    | The monetary amount in cent-precision.                                    | `number`              | `0`     |
| `currency` | The currency associated with the amount, as a ISO 4217 standardized code. | [Currency](#currency) |         |

_All properties are optional._

## PriceIdentifier

Identifies pricing information for a specific SKU

_Object containing the following properties:_

| Property | Description                   | Type                            |
| :------- | :---------------------------- | :------------------------------ |
| `sku`    | The SKU this price applies to | [SKUIdentifier](#skuidentifier) |

_All properties are optional._

## Price

Pricing information for a specific SKU

_Object containing the following properties:_

| Property     | Description                                | Type                                |
| :----------- | :----------------------------------------- | :---------------------------------- |
| `meta`       | Response metadata                          | [Meta](#meta)                       |
| `identifier` | Identifies which SKU this price applies to | [PriceIdentifier](#priceidentifier) |
| `value`      | The actual price amount and currency       | [MonetaryAmount](#monetaryamount)   |

_All properties are optional._

## ProductIdentifier

Identifies a product in the catalog

_Object containing the following properties:_

| Property | Description                       | Type     | Default |
| :------- | :-------------------------------- | :------- | :------ |
| `key`    | Unique product identifier or code | `string` | `''`    |

_All properties are optional._

## Product

Represents a product with its variants, images, and specifications

_Object containing the following properties:_

| Property      | Description                                        | Type                                    | Default |
| :------------ | :------------------------------------------------- | :-------------------------------------- | :------ |
| `meta`        | Response metadata                                  | [Meta](#meta)                           |         |
| `identifier`  | Unique identifier for the product                  | [ProductIdentifier](#productidentifier) |         |
| `name`        | Display name of the product                        | `string`                                | `''`    |
| `slug`        | URL-friendly version of the product name           | `string`                                | `''`    |
| `description` | Detailed product description or marketing copy     | `string`                                | `''`    |
| `skus`        | List of SKUs (variants) available for this product | _Array of [SKU](#sku) items_            | `[]`    |

_All properties are optional._

## SKUIdentifier

Identifies a specific Stock Keeping Unit

_Object containing the following properties:_

| Property       | Description                   | Type     | Default |
| :------------- | :---------------------------- | :------- | :------ |
| **`key`** (\*) | Unique SKU code or identifier | `string` | `''`    |

_(\*) Required._

## SKU

Stock Keeping Unit - represents a specific product variant with its own inventory and pricing

_Object containing the following properties:_

| Property                  | Description                                     | Type                                                               | Default |
| :------------------------ | :---------------------------------------------- | :----------------------------------------------------------------- | :------ |
| `identifier`              | Unique identifier for the SKU                   | [SKUIdentifier](#skuidentifier)                                    |         |
| `image`                   | Primary image for this SKU                      | [Image](#image)                                                    |         |
| `images`                  | Gallery of additional images for this SKU       | _Array of [Image](#image) items_                                   | `[]`    |
| `selectionAttributes`     | Variant-defining attributes like color or size  | _Array of [SelectionAttribute](#selectionattribute) items_         | `[]`    |
| `technicalSpecifications` | Detailed technical specifications for this SKU  | _Array of [TechnicalSpecification](#technicalspecification) items_ | `[]`    |
| `isHero`                  | Whether this SKU should be featured prominently | `boolean`                                                          | `false` |

_All properties are optional._

## SearchIdentifier

Identifies a search query with pagination and filters

_Object containing the following properties:_

| Property            | Description                             | Type                                                                                                                                                                                                                             | Default |
| :------------------ | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------ |
| **`term`** (\*)     | Search query term or keywords           | `string`                                                                                                                                                                                                                         | `''`    |
| **`page`** (\*)     | Page number for pagination (0-indexed)  | `number`                                                                                                                                                                                                                         | `0`     |
| **`pageSize`** (\*) | Number of results per page              | `number`                                                                                                                                                                                                                         | `20`    |
| **`facets`** (\*)   | Active facet filters to apply to search | _Array of objects:_<br /><ul><li>**`facet`** (\*): _Object with properties:_<ul><li>**`key`** (\*): `string` - Unique key identifying the facet (e.g., "brand", "category")</li></ul></li><li>**`key`** (\*): `string`</li></ul> | `[]`    |

_(\*) Required._

## SearchResultFacet

A search facet containing filterable values and their counts

_Object containing the following properties:_

| Property     | Description                                            | Type                                                               | Default |
| :----------- | :----------------------------------------------------- | :----------------------------------------------------------------- | :------ |
| `identifier` | Unique identifier for this facet                       | [FacetIdentifier](#facetidentifier)                                |         |
| `name`       | Display name for the facet (e.g., "Brand", "Category") | `string`                                                           | `''`    |
| `values`     | Available values for this facet                        | _Array of [SearchResultFacetValue](#searchresultfacetvalue) items_ | `[]`    |

_All properties are optional._

## SearchResultFacetValue

A selectable value within a search facet with result count

_Object containing the following properties:_

| Property     | Description                                       | Type                                          | Default |
| :----------- | :------------------------------------------------ | :-------------------------------------------- | :------ |
| `identifier` | Unique identifier for this facet value            | [FacetValueIdentifier](#facetvalueidentifier) |         |
| `name`       | Display name for the facet value                  | `string`                                      | `''`    |
| `count`      | Number of matching products with this facet value | `number`                                      | `0`     |
| `active`     | Whether this facet value is currently selected    | `boolean`                                     | `false` |

_All properties are optional._

## SearchResultProduct

Simplified product data for search result display

_Object containing the following properties:_

| Property     | Description                              | Type                                    | Default |
| :----------- | :--------------------------------------- | :-------------------------------------- | :------ |
| `identifier` | Unique product identifier                | [ProductIdentifier](#productidentifier) |         |
| `name`       | Product display name                     | `string`                                | `''`    |
| `image`      | Primary product image for search results | [Image](#image)                         |         |
| `slug`       | URL-friendly product identifier          | `string`                                | `''`    |

_All properties are optional._

## SearchResult

Complete search results including products, pagination, and facets

_Object containing the following properties:_

| Property     | Description                                   | Type                                                         | Default |
| :----------- | :-------------------------------------------- | :----------------------------------------------------------- | :------ |
| `meta`       | Response metadata                             | [Meta](#meta)                                                |         |
| `identifier` | The search query that produced these results  | [SearchIdentifier](#searchidentifier)                        |         |
| `products`   | List of products matching the search criteria | _Array of [SearchResultProduct](#searchresultproduct) items_ | `[]`    |
| `pages`      | Total number of pages available               | `number`                                                     | `0`     |
| `facets`     | Available facets for refining search results  | _Array of [SearchResultFacet](#searchresultfacet) items_     | `[]`    |

_All properties are optional._

## SelectionAttribute

Attributes used for product variant selection (e.g., color, size, material)

_Object containing the following properties:_

| Property         | Description                                           | Type     |
| :--------------- | :---------------------------------------------------- | :------- |
| **`id`** (\*)    | Unique identifier for the attribute                   | `string` |
| **`name`** (\*)  | Display name of the attribute (e.g., "Color", "Size") | `string` |
| **`value`** (\*) | The value of the attribute (e.g., "Red", "Large")     | `string` |

_(\*) Required._

## Session

_Object containing the following properties:_

| Property      | Description                                  | Type                  |
| :------------ | :------------------------------------------- | :-------------------- |
| **`id`** (\*) |                                              | `string`              |
| `identity`    | User identity and authentication information | [Identity](#identity) |

_(\*) Required._

## TechnicalSpecification

Technical specifications and detailed product information for reference

_Object containing the following properties:_

| Property         | Description                                                        | Type     |
| :--------------- | :----------------------------------------------------------------- | :------- |
| **`id`** (\*)    | Unique identifier for the specification                            | `string` |
| **`name`** (\*)  | Name of the technical specification (e.g., "Weight", "Dimensions") | `string` |
| **`value`** (\*) | The value of the specification (e.g., "2.5 kg", "30x20x10 cm")     | `string` |

_(\*) Required._
