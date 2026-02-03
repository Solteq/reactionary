# Schemas Schemas

## AddressIdentifier

_Object containing the following properties:_

| Property            | Type     |
| :------------------ | :------- |
| **`nickName`** (\*) | `string` |

_(\*) Required._

## Address

_Object containing the following properties:_

| Property                 | Type                                    |
| :----------------------- | :-------------------------------------- |
| `identifier`             | [AddressIdentifier](#addressidentifier) |
| **`firstName`** (\*)     | `string`                                |
| **`lastName`** (\*)      | `string`                                |
| **`streetAddress`** (\*) | `string`                                |
| **`streetNumber`** (\*)  | `string`                                |
| **`city`** (\*)          | `string`                                |
| **`region`** (\*)        | `string`                                |
| **`postalCode`** (\*)    | `string`                                |
| **`countryCode`** (\*)   | `string`                                |

_(\*) Required._

## AnalyticsEvent

_Object containing the following properties:_

| Property | Type |
| :------- | :--- |

_All properties are optional._

## AnalyticsMutationPageViewEvent

_Object containing the following properties:_

| Property         | Type          |
| :--------------- | :------------ |
| **`event`** (\*) | `'page-view'` |
| **`url`** (\*)   | `string`      |

_(\*) Required._

## AnalyticsMutation

_Union of the following possible types:_

- [AnalyticsMutationPageViewEvent](#analyticsmutationpageviewevent)
- [AnalyticsMutationSearchEvent](#analyticsmutationsearchevent)
- [AnalyticsMutationSearchProductClickEvent](#analyticsmutationsearchproductclickevent)

## AnalyticsMutationSearchEvent

_Object containing the following properties:_

| Property            | Type                                                     |
| :------------------ | :------------------------------------------------------- |
| **`event`** (\*)    | `'product-search'`                                       |
| **`search`** (\*)   | [ProductSearchIdentifier](#productsearchidentifier)      |
| **`products`** (\*) | _Array of [ProductIdentifier](#productidentifier) items_ |

_(\*) Required._

## AnalyticsMutationSearchProductClickEvent

_Object containing the following properties:_

| Property            | Type                                                |
| :------------------ | :-------------------------------------------------- |
| **`event`** (\*)    | `'product-search-click'`                            |
| **`search`** (\*)   | [ProductSearchIdentifier](#productsearchidentifier) |
| **`product`** (\*)  | [ProductIdentifier](#productidentifier)             |
| **`position`** (\*) | `number` (_≥0_)                                     |

_(\*) Required._

## AnonymousIdentity

_Object containing the following properties:_

| Property        | Type          |
| :-------------- | :------------ |
| **`type`** (\*) | `'Anonymous'` |

_(\*) Required._

## BaseModel

_Object containing the following properties:_

| Property | Type |
| :------- | :--- |

_All properties are optional._

## BaseMutation

_Object containing the following properties:_

| Property | Type |
| :------- | :--- |

_All properties are optional._

## BaseQuery

_Object containing the following properties:_

| Property | Type |
| :------- | :--- |

_All properties are optional._

## Capabilities

_Object containing the following properties:_

| Property                 | Type      |
| :----------------------- | :-------- |
| **`product`** (\*)       | `boolean` |
| **`productSearch`** (\*) | `boolean` |
| **`analytics`** (\*)     | `boolean` |
| **`identity`** (\*)      | `boolean` |
| **`cart`** (\*)          | `boolean` |
| **`checkout`** (\*)      | `boolean` |
| **`order`** (\*)         | `boolean` |
| **`orderSearch`** (\*)   | `boolean` |
| **`inventory`** (\*)     | `boolean` |
| **`price`** (\*)         | `boolean` |
| **`category`** (\*)      | `boolean` |
| **`store`** (\*)         | `boolean` |
| **`profile`** (\*)       | `boolean` |

_(\*) Required._

## CartIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._

## CartItemIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._

## CartItem

_Object containing the following properties:_

| Property     | Type                                                  | Default |
| :----------- | :---------------------------------------------------- | :------ |
| `identifier` | [CartItemIdentifier](#cartitemidentifier)             |         |
| `product`    | [ProductIdentifier](#productidentifier)               |         |
| `variant`    | [ProductVariantIdentifier](#productvariantidentifier) |         |
| `quantity`   | `number`                                              | `0`     |
| `price`      | [ItemCostBreakdown](#itemcostbreakdown)               |         |

_All properties are optional._

## CartMutationAddPaymentMethod

_Object containing the following properties:_

| Property                   | Description                                                                                                                 | Type                                                |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------- |
| **`cart`** (\*)            |                                                                                                                             | [CartIdentifier](#cartidentifier)                   |
| **`paymentMethodId`** (\*) |                                                                                                                             | [PaymentMethodIdentifier](#paymentmethodidentifier) |
| `amount`                   | The amount to authorize for the payment method. If not provided, the full remaining balance of the cart will be authorized. | [MonetaryAmount](#monetaryamount)                   |

_(\*) Required._

## CartMutationApplyCoupon

_Object containing the following properties:_

| Property              | Type                              |
| :-------------------- | :-------------------------------- |
| **`cart`** (\*)       | [CartIdentifier](#cartidentifier) |
| **`couponCode`** (\*) | `string`                          |

_(\*) Required._

## CartMutationChangeCurrency

_Object containing the following properties:_

| Property               | Description                           | Type                                                                |
| :--------------------- | :------------------------------------ | :------------------------------------------------------------------ |
| **`cart`** (\*)        |                                       | _Object with properties:_<ul><li>**`key`** (\*): `string`</li></ul> |
| **`newCurrency`** (\*) | The new currency to set for the cart. | [Currency](#currency)                                               |

_(\*) Required._

## CartMutationCheckout

_Object containing the following properties:_

| Property        | Type                              |
| :-------------- | :-------------------------------- |
| **`cart`** (\*) | [CartIdentifier](#cartidentifier) |

_(\*) Required._

## CartMutationDeleteCart

_Object containing the following properties:_

| Property        | Type                              |
| :-------------- | :-------------------------------- |
| **`cart`** (\*) | [CartIdentifier](#cartidentifier) |

_(\*) Required._

## CartMutationItemAdd

_Object containing the following properties:_

| Property            | Type                                                  |
| :------------------ | :---------------------------------------------------- |
| `cart`              | [CartIdentifier](#cartidentifier)                     |
| **`variant`** (\*)  | [ProductVariantIdentifier](#productvariantidentifier) |
| **`quantity`** (\*) | `number`                                              |

_(\*) Required._

## CartMutationItemQuantityChange

_Object containing the following properties:_

| Property            | Type                                      |
| :------------------ | :---------------------------------------- |
| **`cart`** (\*)     | [CartIdentifier](#cartidentifier)         |
| **`item`** (\*)     | [CartItemIdentifier](#cartitemidentifier) |
| **`quantity`** (\*) | `number`                                  |

_(\*) Required._

## CartMutationItemRemove

_Object containing the following properties:_

| Property        | Type                                      |
| :-------------- | :---------------------------------------- |
| **`cart`** (\*) | [CartIdentifier](#cartidentifier)         |
| **`item`** (\*) | [CartItemIdentifier](#cartitemidentifier) |

_(\*) Required._

## CartMutationRemoveCoupon

_Object containing the following properties:_

| Property              | Type                              |
| :-------------------- | :-------------------------------- |
| **`cart`** (\*)       | [CartIdentifier](#cartidentifier) |
| **`couponCode`** (\*) | `string`                          |

_(\*) Required._

## CartMutationRemovePaymentMethod

_Object containing the following properties:_

| Property        | Type                              |
| :-------------- | :-------------------------------- |
| **`cart`** (\*) | [CartIdentifier](#cartidentifier) |

_(\*) Required._

## CartMutationSetBillingAddress

_Object containing the following properties:_

| Property                   | Type                              |
| :------------------------- | :-------------------------------- |
| **`cart`** (\*)            | [CartIdentifier](#cartidentifier) |
| **`billingAddress`** (\*)  | [Address](#address)               |
| `notificationEmailAddress` | `string`                          |
| `notificationPhoneNumber`  | `string`                          |

_(\*) Required._

## CartMutationSetShippingInfo

_Object containing the following properties:_

| Property          | Type                                                  |
| :---------------- | :---------------------------------------------------- |
| **`cart`** (\*)   | [CartIdentifier](#cartidentifier)                     |
| `shippingMethod`  | [ShippingMethodIdentifier](#shippingmethodidentifier) |
| `shippingAddress` | [Address](#address)                                   |

_(\*) Required._

## CartQueryById

_Object containing the following properties:_

| Property        | Type                              |
| :-------------- | :-------------------------------- |
| **`cart`** (\*) | [CartIdentifier](#cartidentifier) |

_(\*) Required._

## Cart

_Object containing the following properties:_

| Property      | Type                                      | Default |
| :------------ | :---------------------------------------- | :------ |
| `identifier`  | [CartIdentifier](#cartidentifier)         |         |
| `userId`      | [IdentityIdentifier](#identityidentifier) |         |
| `items`       | _Array of [CartItem](#cartitem) items_    | `[]`    |
| `price`       | [CostBreakDown](#costbreakdown)           |         |
| `name`        | `string`                                  | `''`    |
| `description` | `string`                                  | `''`    |

_All properties are optional._

## CategoryIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._

## CategoryPaginatedResult

_Object containing the following properties:_

| Property              | Description                          | Type                                   |
| :-------------------- | :----------------------------------- | :------------------------------------- |
| **`pageNumber`** (\*) | Current page number, starting from 1 | `number` (_≥1_)                        |
| **`pageSize`** (\*)   | Number of items per page             | `number` (_≥1_)                        |
| **`totalCount`** (\*) | Total number of items available      | `number` (_≥0_)                        |
| **`totalPages`** (\*) | Total number of pages available      | `number` (_≥0_)                        |
| **`items`** (\*)      |                                      | _Array of [Category](#category) items_ |

_(\*) Required._

## CategoryQueryById

_Object containing the following properties:_

| Property      | Type                                      |
| :------------ | :---------------------------------------- |
| **`id`** (\*) | [CategoryIdentifier](#categoryidentifier) |

_(\*) Required._

## CategoryQueryBySlug

_Object containing the following properties:_

| Property        | Type     |
| :-------------- | :------- |
| **`slug`** (\*) | `string` |

_(\*) Required._

## CategoryQueryForBreadcrumb

_Object containing the following properties:_

| Property      | Type                                      |
| :------------ | :---------------------------------------- |
| **`id`** (\*) | [CategoryIdentifier](#categoryidentifier) |

_(\*) Required._

## CategoryQueryForChildCategories

_Object containing the following properties:_

| Property                     | Type                                      |
| :--------------------------- | :---------------------------------------- |
| **`parentId`** (\*)          | [CategoryIdentifier](#categoryidentifier) |
| **`paginationOptions`** (\*) | [PaginationOptions](#paginationoptions)   |

_(\*) Required._

## CategoryQueryForTopCategories

_Object containing the following properties:_

| Property                     | Type                                    |
| :--------------------------- | :-------------------------------------- |
| **`paginationOptions`** (\*) | [PaginationOptions](#paginationoptions) |

_(\*) Required._

## Category

_Object containing the following properties:_

| Property         | Type                                                                                                                                                                                  | Default |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------ |
| `identifier`     | [CategoryIdentifier](#categoryidentifier)                                                                                                                                             |         |
| `name`           | `string`                                                                                                                                                                              | `''`    |
| `slug`           | `string`                                                                                                                                                                              | `''`    |
| `text`           | `string`                                                                                                                                                                              | `''`    |
| `images`         | _Array of objects:_<br /><ul><li>**`sourceUrl`** (\*): `string`</li><li>**`altText`** (\*): `string`</li><li>**`width`** (\*): `number`</li><li>**`height`** (\*): `number`</li></ul> | `[]`    |
| `parentCategory` | [CategoryIdentifier](#categoryidentifier)                                                                                                                                             |         |

_All properties are optional._

## CheckoutIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._

## CheckoutItemIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._

## CheckoutItem

_Object containing the following properties:_

| Property     | Type                                                  | Default |
| :----------- | :---------------------------------------------------- | :------ |
| `identifier` | [CheckoutItemIdentifier](#checkoutitemidentifier)     |         |
| `variant`    | [ProductVariantIdentifier](#productvariantidentifier) |         |
| `quantity`   | `number`                                              | `0`     |
| `price`      | [ItemCostBreakdown](#itemcostbreakdown)               |         |

_All properties are optional._

## CheckoutMutationAddPaymentInstruction

_Object containing the following properties:_

| Property                      | Type                                                                                                                                                                                                                                                                                                                                                |
| :---------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`paymentInstruction`** (\*) | _Object with properties:_<ul><li>**`amount`** (\*): [MonetaryAmount](#monetaryamount)</li><li>**`paymentMethod`** (\*): [PaymentMethodIdentifier](#paymentmethodidentifier)</li><li>**`protocolData`** (\*): _Array of [PaymentProtocolData](#paymentprotocoldata) items_ - Additional protocol-specific data for processing the payment.</li></ul> |
| **`checkout`** (\*)           | [CartIdentifier](#cartidentifier)                                                                                                                                                                                                                                                                                                                   |

_(\*) Required._

## CheckoutMutationFinalizeCheckout

_Object containing the following properties:_

| Property            | Type                              |
| :------------------ | :-------------------------------- |
| **`checkout`** (\*) | [CartIdentifier](#cartidentifier) |

_(\*) Required._

## CheckoutMutationInitiateCheckout

_Object containing the following properties:_

| Property            | Type                                                                                                                                                                                                                                                                                                                                                        |
| :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`cart`** (\*)     | [Cart](#cart)                                                                                                                                                                                                                                                                                                                                               |
| `billingAddress`    | _Object with properties:_<ul><li>**`firstName`** (\*): `string`</li><li>**`lastName`** (\*): `string`</li><li>**`streetAddress`** (\*): `string`</li><li>**`streetNumber`** (\*): `string`</li><li>**`city`** (\*): `string`</li><li>**`region`** (\*): `string`</li><li>**`postalCode`** (\*): `string`</li><li>**`countryCode`** (\*): `string`</li></ul> |
| `notificationEmail` | `string`                                                                                                                                                                                                                                                                                                                                                    |
| `notificationPhone` | `string`                                                                                                                                                                                                                                                                                                                                                    |

_(\*) Required._

## CheckoutMutationRemovePaymentInstruction

_Object containing the following properties:_

| Property                      | Type                                                          |
| :---------------------------- | :------------------------------------------------------------ |
| **`paymentInstruction`** (\*) | [PaymentInstructionIdentifier](#paymentinstructionidentifier) |
| **`checkout`** (\*)           | [CartIdentifier](#cartidentifier)                             |

_(\*) Required._

## CheckoutMutationSetShippingAddress

_Object containing the following properties:_

| Property                   | Type                                                                                                                                                                                                                                                                                                                                                        |
| :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`checkout`** (\*)        | [CartIdentifier](#cartidentifier)                                                                                                                                                                                                                                                                                                                           |
| **`shippingAddress`** (\*) | _Object with properties:_<ul><li>**`firstName`** (\*): `string`</li><li>**`lastName`** (\*): `string`</li><li>**`streetAddress`** (\*): `string`</li><li>**`streetNumber`** (\*): `string`</li><li>**`city`** (\*): `string`</li><li>**`region`** (\*): `string`</li><li>**`postalCode`** (\*): `string`</li><li>**`countryCode`** (\*): `string`</li></ul> |

_(\*) Required._

## CheckoutMutationSetShippingInstruction

_Object containing the following properties:_

| Property                       | Type                                        |
| :----------------------------- | :------------------------------------------ |
| **`shippingInstruction`** (\*) | [ShippingInstruction](#shippinginstruction) |
| **`checkout`** (\*)            | [CartIdentifier](#cartidentifier)           |

_(\*) Required._

## CheckoutQueryById

_Object containing the following properties:_

| Property              | Type                                      |
| :-------------------- | :---------------------------------------- |
| **`identifier`** (\*) | [CheckoutIdentifier](#checkoutidentifier) |

_(\*) Required._

## CheckoutQueryForAvailablePaymentMethods

_Object containing the following properties:_

| Property            | Type                                      |
| :------------------ | :---------------------------------------- |
| **`checkout`** (\*) | [CheckoutIdentifier](#checkoutidentifier) |

_(\*) Required._

## CheckoutQueryForAvailableShippingMethods

_Object containing the following properties:_

| Property            | Type                                      |
| :------------------ | :---------------------------------------- |
| **`checkout`** (\*) | [CheckoutIdentifier](#checkoutidentifier) |

_(\*) Required._

## Checkout

_Object containing the following properties:_

| Property                  | Description                                                                                                                                                                                                             | Type                                                                                                                                                                                                                                                                                                                                                                                                                                   | Default |
| :------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------ |
| `identifier`              |                                                                                                                                                                                                                         | [CheckoutIdentifier](#checkoutidentifier)                                                                                                                                                                                                                                                                                                                                                                                              |         |
| `originalCartReference`   |                                                                                                                                                                                                                         | [CartIdentifier](#cartidentifier)                                                                                                                                                                                                                                                                                                                                                                                                      |         |
| `resultingOrder`          |                                                                                                                                                                                                                         | [OrderIdentifier](#orderidentifier)                                                                                                                                                                                                                                                                                                                                                                                                    |         |
| `items`                   |                                                                                                                                                                                                                         | _Array of [CheckoutItem](#checkoutitem) items_                                                                                                                                                                                                                                                                                                                                                                                         | `[]`    |
| `price`                   |                                                                                                                                                                                                                         | [CostBreakDown](#costbreakdown)                                                                                                                                                                                                                                                                                                                                                                                                        |         |
| `name`                    |                                                                                                                                                                                                                         | `string`                                                                                                                                                                                                                                                                                                                                                                                                                               | `''`    |
| `description`             |                                                                                                                                                                                                                         | `string`                                                                                                                                                                                                                                                                                                                                                                                                                               | `''`    |
| **`billingAddress`** (\*) |                                                                                                                                                                                                                         | _Object with properties:_<ul><li>`identifier`: [AddressIdentifier](#addressidentifier)</li><li>**`firstName`** (\*): `string`</li><li>**`lastName`** (\*): `string`</li><li>**`streetAddress`** (\*): `string`</li><li>**`streetNumber`** (\*): `string`</li><li>**`city`** (\*): `string`</li><li>**`region`** (\*): `string`</li><li>**`postalCode`** (\*): `string`</li><li>**`countryCode`** (\*): `string`</li></ul> (_nullable_) |         |
| `shippingAddress`         |                                                                                                                                                                                                                         | [Address](#address)                                                                                                                                                                                                                                                                                                                                                                                                                    |         |
| `shippingInstruction`     |                                                                                                                                                                                                                         | [ShippingInstruction](#shippinginstruction)                                                                                                                                                                                                                                                                                                                                                                                            |         |
| `paymentInstructions`     |                                                                                                                                                                                                                         | _Array of [PaymentInstruction](#paymentinstruction) items_                                                                                                                                                                                                                                                                                                                                                                             | `[]`    |
| `readyForFinalization`    | Indicates if the checkout has all the required information to be finalized into an order. This does not mean it will succeed, as there may be issues with payment or shipping, but all required information is present. | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                              | `false` |

_(\*) Required._

## CostBreakDown

_Object containing the following properties:_

| Property            | Description                                                                    | Type                              |
| :------------------ | :----------------------------------------------------------------------------- | :-------------------------------- |
| `totalTax`          | The amount of tax paid on the cart. This may include VAT, GST, sales tax, etc. | [MonetaryAmount](#monetaryamount) |
| `totalDiscount`     | The amount of discount applied to the cart.                                    | [MonetaryAmount](#monetaryamount) |
| `totalSurcharge`    | The amount of surcharge applied to the cart.                                   | [MonetaryAmount](#monetaryamount) |
| `totalShipping`     | The amount of shipping fees for the cart.                                      | [MonetaryAmount](#monetaryamount) |
| `totalProductPrice` | The total price of products in the cart.                                       | [MonetaryAmount](#monetaryamount) |
| `grandTotal`        | The total price for the cart including all taxes, discounts, and shipping.     | [MonetaryAmount](#monetaryamount) |

_All properties are optional._

## Currency

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

## CustomerPriceQuery

_Object containing the following properties:_

| Property           | Type                                                  |
| :----------------- | :---------------------------------------------------- |
| **`variant`** (\*) | [ProductVariantIdentifier](#productvariantidentifier) |

_(\*) Required._

## FacetIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._

## FacetValueIdentifier

_Object containing the following properties:_

| Property         | Type                                |
| :--------------- | :---------------------------------- |
| **`facet`** (\*) | [FacetIdentifier](#facetidentifier) |
| **`key`** (\*)   | `string`                            |

_(\*) Required._

## FulfillmentCenterIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._

## GenericError

_Object containing the following properties:_

| Property           | Type                       |
| :----------------- | :------------------------- |
| **`type`** (\*)    | `'Generic'`                |
| **`message`** (\*) | `string` (_min length: 1_) |

_(\*) Required._

## GuestIdentity

_Object containing the following properties:_

| Property        | Type                                      |
| :-------------- | :---------------------------------------- |
| **`id`** (\*)   | [IdentityIdentifier](#identityidentifier) |
| **`type`** (\*) | `'Guest'`                                 |

_(\*) Required._

## IdentityIdentifier

_Object containing the following properties:_

| Property          | Type     |
| :---------------- | :------- |
| **`userId`** (\*) | `string` |

_(\*) Required._

## IdentityMutationLogin

_Object containing the following properties:_

| Property            | Type     |
| :------------------ | :------- |
| **`username`** (\*) | `string` |
| **`password`** (\*) | `string` |

_(\*) Required._

## IdentityMutationLogout

_Object containing the following properties:_

| Property | Type |
| :------- | :--- |

_All properties are optional._

## IdentityMutationRegister

_Object containing the following properties:_

| Property            | Type     |
| :------------------ | :------- |
| **`username`** (\*) | `string` |
| **`password`** (\*) | `string` |

_(\*) Required._

## IdentityQuerySelf

_Object containing the following properties:_

| Property | Type |
| :------- | :--- |

_All properties are optional._

## Identity

_Union of the following possible types:_

- [AnonymousIdentity](#anonymousidentity)
- [GuestIdentity](#guestidentity)
- [RegisteredIdentity](#registeredidentity)

## Image

_Object containing the following properties:_

| Property    | Description                                                                                                                                                    | Type     | Default |
| :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ |
| `sourceUrl` | The original source URL of the image. Pass this through your image resizing and transcoding service to get the desired size, and generate thumbnails as needed | `string` | `''`    |
| `altText`   | Alternative text for the image, for accessibility purposes. Must always be set, and non-empty                                                                  | `string` | `''`    |
| `width`     | Width of the original image, in pixels, if known                                                                                                               | `number` |         |
| `height`    | Height of the original image, in pixels, if known                                                                                                              | `number` |         |

_All properties are optional._

## InvalidInputError

_Object containing the following properties:_

| Property         | Type             |
| :--------------- | :--------------- |
| **`type`** (\*)  | `'InvalidInput'` |
| **`error`** (\*) | `string`         |

_(\*) Required._

## InvalidOutputError

_Object containing the following properties:_

| Property         | Type              |
| :--------------- | :---------------- |
| **`type`** (\*)  | `'InvalidOutput'` |
| **`error`** (\*) | `string`          |

_(\*) Required._

## InventoryIdentifier

_Object containing the following properties:_

| Property                     | Type                                                        |
| :--------------------------- | :---------------------------------------------------------- |
| **`variant`** (\*)           | [ProductVariantIdentifier](#productvariantidentifier)       |
| **`fulfillmentCenter`** (\*) | [FulfillmentCenterIdentifier](#fulfillmentcenteridentifier) |

_(\*) Required._

## InventoryQueryBySKU

_Object containing the following properties:_

| Property                    | Description                                          | Type                                                        |
| :-------------------------- | :--------------------------------------------------- | :---------------------------------------------------------- |
| **`variant`** (\*)          | The unique identifier for the product variant (SKU). | [ProductVariantIdentifier](#productvariantidentifier)       |
| **`fulfilmentCenter`** (\*) |                                                      | [FulfillmentCenterIdentifier](#fulfillmentcenteridentifier) |

_(\*) Required._

## Inventory

_Object containing the following properties:_

| Property              | Type                                        |
| :-------------------- | :------------------------------------------ |
| **`identifier`** (\*) | [InventoryIdentifier](#inventoryidentifier) |
| **`quantity`** (\*)   | `number`                                    |
| **`status`** (\*)     | [InventoryStatus](#inventorystatus)         |

_(\*) Required._

## InventoryStatus

_Enum, one of the following possible values:_

- `'inStock'`
- `'outOfStock'`
- `'onBackOrder'`
- `'preOrder'`
- `'discontinued'`

## ItemCostBreakdown

_Object containing the following properties:_

| Property        | Description                                          | Type                              |
| :-------------- | :--------------------------------------------------- | :-------------------------------- |
| `unitPrice`     | The price per single unit of the item.               | [MonetaryAmount](#monetaryamount) |
| `unitDiscount`  | The discount applied per single unit of the item.    | [MonetaryAmount](#monetaryamount) |
| `totalPrice`    | The total price for all units of the item.           | [MonetaryAmount](#monetaryamount) |
| `totalDiscount` | The total discount applied to all units of the item. | [MonetaryAmount](#monetaryamount) |

_All properties are optional._

## LanguageContext

_Object containing the following properties:_

| Property       | Type                  | Default   |
| :------------- | :-------------------- | :-------- |
| `locale`       | `string`              | `'en-US'` |
| `currencyCode` | [Currency](#currency) |           |

_All properties are optional._

## ListPriceQuery

_Object containing the following properties:_

| Property           | Type                                                  |
| :----------------- | :---------------------------------------------------- |
| **`variant`** (\*) | [ProductVariantIdentifier](#productvariantidentifier) |

_(\*) Required._

## MonetaryAmount

_Object containing the following properties:_

| Property            | Description                                                               | Type                  |
| :------------------ | :------------------------------------------------------------------------ | :-------------------- |
| **`value`** (\*)    | The monetary amount in decimal-precision.                                 | `number`              |
| **`currency`** (\*) | The currency associated with the amount, as a ISO 4217 standardized code. | [Currency](#currency) |

_(\*) Required._

## NotFoundError

_Object containing the following properties:_

| Property              | Type         |
| :-------------------- | :----------- |
| **`type`** (\*)       | `'NotFound'` |
| **`identifier`** (\*) | `unknown`    |

_(\*) Required._

## OrderIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._

## OrderInventoryStatus

The inventory release status of the order.

_Enum, one of the following possible values:_

- `'NotAllocated'`
- `'Allocated'`
- `'Backordered'`
- `'Preordered'`

## OrderItemIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._

## OrderItem

_Object containing the following properties:_

| Property                   | Description                                     | Type                                                  |
| :------------------------- | :---------------------------------------------- | :---------------------------------------------------- |
| **`identifier`** (\*)      |                                                 | [OrderItemIdentifier](#orderitemidentifier)           |
| **`variant`** (\*)         |                                                 | [ProductVariantIdentifier](#productvariantidentifier) |
| **`quantity`** (\*)        |                                                 | `number`                                              |
| **`price`** (\*)           |                                                 | [ItemCostBreakdown](#itemcostbreakdown)               |
| **`inventoryStatus`** (\*) | The inventory release status of the order item. | [OrderInventoryStatus](#orderinventorystatus)         |

_(\*) Required._

## OrderQueryById

_Object containing the following properties:_

| Property         | Type                                |
| :--------------- | :---------------------------------- |
| **`order`** (\*) | [OrderIdentifier](#orderidentifier) |

_(\*) Required._

## Order

_Object containing the following properties:_

| Property                       | Description                                              | Type                                                       |
| :----------------------------- | :------------------------------------------------------- | :--------------------------------------------------------- |
| **`identifier`** (\*)          |                                                          | [OrderIdentifier](#orderidentifier)                        |
| **`userId`** (\*)              |                                                          | [IdentityIdentifier](#identityidentifier)                  |
| **`items`** (\*)               |                                                          | _Array of [OrderItem](#orderitem) items_                   |
| **`price`** (\*)               |                                                          | [CostBreakDown](#costbreakdown)                            |
| `name`                         |                                                          | `string`                                                   |
| `description`                  |                                                          | `string`                                                   |
| `shippingAddress`              |                                                          | [Address](#address)                                        |
| `billingAddress`               |                                                          | [Address](#address)                                        |
| `shippingMethod`               |                                                          | [ShippingMethod](#shippingmethod)                          |
| **`orderStatus`** (\*)         | The current status of the order.                         | [OrderStatus](#orderstatus)                                |
| **`inventoryStatus`** (\*)     | The inventory release status of the order.               | [OrderInventoryStatus](#orderinventorystatus)              |
| **`paymentInstructions`** (\*) |                                                          | _Array of [PaymentInstruction](#paymentinstruction) items_ |
| `cartReference`                | Reference to the cart from which this order was created. | [CartIdentifier](#cartidentifier)                          |

_(\*) Required._

## OrderSearchIdentifier

_Object containing the following properties:_

| Property                     | Description                                                                                                  | Type                                         |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------- | :------------------------------------------- |
| **`term`** (\*)              | The search term used to find orders. Not all providers may support term-based search for orders.             | `string`                                     |
| `partNumber`                 | An optional list part number to filter orders by specific products. Will be ANDed together.                  | `Array<string>`                              |
| `orderStatus`                | An optional list of order statuses to filter the search results.                                             | _Array of [OrderStatus](#orderstatus) items_ |
| `userId`                     | An optional user ID to filter orders by specific users. Mostly for b2b usecases with hierachial order access | [IdentityIdentifier](#identityidentifier)    |
| `startDate`                  | An optional start date to filter orders from a specific date onwards. ISO8601                                | `string`                                     |
| `endDate`                    | An optional end date to filter orders up to a specific date. ISO8601                                         | `string`                                     |
| **`filters`** (\*)           | Additional filters applied to the search results.                                                            | `Array<string>`                              |
| **`paginationOptions`** (\*) | Pagination options for the search results.                                                                   | [PaginationOptions](#paginationoptions)      |

_(\*) Required._

## OrderSearchQueryByTerm

_Object containing the following properties:_

| Property          | Type                                            |
| :---------------- | :---------------------------------------------- |
| **`search`** (\*) | [OrderSearchIdentifier](#ordersearchidentifier) |

_(\*) Required._

## OrderSearchResultItem

_Object containing the following properties:_

| Property                   | Description                                | Type                                          |
| :------------------------- | :----------------------------------------- | :-------------------------------------------- |
| **`identifier`** (\*)      |                                            | [OrderIdentifier](#orderidentifier)           |
| **`userId`** (\*)          |                                            | [IdentityIdentifier](#identityidentifier)     |
| **`customerName`** (\*)    |                                            | `string`                                      |
| `shippingAddress`          |                                            | [Address](#address)                           |
| **`orderDate`** (\*)       |                                            | `string`                                      |
| **`orderStatus`** (\*)     | The current status of the order.           | [OrderStatus](#orderstatus)                   |
| **`inventoryStatus`** (\*) | The inventory release status of the order. | [OrderInventoryStatus](#orderinventorystatus) |
| **`totalAmount`** (\*)     |                                            | [MonetaryAmount](#monetaryamount)             |

_(\*) Required._

## OrderSearchResult

_Object containing the following properties:_

| Property              | Description                          | Type                                                             |
| :-------------------- | :----------------------------------- | :--------------------------------------------------------------- |
| **`pageNumber`** (\*) | Current page number, starting from 1 | `number` (_≥1_)                                                  |
| **`pageSize`** (\*)   | Number of items per page             | `number` (_≥1_)                                                  |
| **`totalCount`** (\*) | Total number of items available      | `number` (_≥0_)                                                  |
| **`totalPages`** (\*) | Total number of pages available      | `number` (_≥0_)                                                  |
| **`items`** (\*)      |                                      | _Array of [OrderSearchResultItem](#ordersearchresultitem) items_ |
| **`identifier`** (\*) |                                      | [OrderSearchIdentifier](#ordersearchidentifier)                  |

_(\*) Required._

## OrderStatus

The current status of the order.

_Enum, one of the following possible values:_

- `'AwaitingPayment'`
- `'ReleasedToFulfillment'`
- `'Shipped'`
- `'Cancelled'`

## PaginationOptions

_Object containing the following properties:_

| Property     | Description                          | Type                 | Default |
| :----------- | :----------------------------------- | :------------------- | :------ |
| `pageNumber` | Current page number, starting from 1 | `number`             | `1`     |
| `pageSize`   | Number of items per page             | `number` (_≥1, ≤50_) | `20`    |

_All properties are optional._

## PaymentInstructionIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._

## PaymentInstruction

_Object containing the following properties:_

| Property                 | Description                                                   | Type                                                          |
| :----------------------- | :------------------------------------------------------------ | :------------------------------------------------------------ |
| **`identifier`** (\*)    |                                                               | [PaymentInstructionIdentifier](#paymentinstructionidentifier) |
| **`amount`** (\*)        |                                                               | [MonetaryAmount](#monetaryamount)                             |
| **`paymentMethod`** (\*) |                                                               | [PaymentMethodIdentifier](#paymentmethodidentifier)           |
| **`protocolData`** (\*)  | Additional protocol-specific data for processing the payment. | _Array of [PaymentProtocolData](#paymentprotocoldata) items_  |
| **`status`** (\*)        |                                                               | [PaymentStatus](#paymentstatus)                               |

_(\*) Required._

## PaymentMethodIdentifier

_Object containing the following properties:_

| Property                    | Type     |
| :-------------------------- | :------- |
| **`method`** (\*)           | `string` |
| **`name`** (\*)             | `string` |
| **`paymentProcessor`** (\*) | `string` |

_(\*) Required._

## PaymentMethod

_Object containing the following properties:_

| Property               | Type                                                |
| :--------------------- | :-------------------------------------------------- |
| **`identifier`** (\*)  | [PaymentMethodIdentifier](#paymentmethodidentifier) |
| `logo`                 | [Image](#image)                                     |
| **`description`** (\*) | `string`                                            |
| **`isPunchOut`** (\*)  | `boolean`                                           |

_(\*) Required._

## PaymentProtocolData

_Object containing the following properties:_

| Property         | Type     |
| :--------------- | :------- |
| **`key`** (\*)   | `string` |
| **`value`** (\*) | `string` |

_(\*) Required._

## PaymentStatus

_Enum, one of the following possible values:_

- `'pending'`
- `'authorized'`
- `'canceled'`
- `'capture'`
- `'partial_capture'`
- `'refunded'`
- `'partial_refund'`

## PickupPointIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._

## PickupPoint

_Object containing the following properties:_

| Property               | Description                                                                                          | Type                                                                |
| :--------------------- | :--------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------ |
| **`identifier`** (\*)  |                                                                                                      | _Object with properties:_<ul><li>**`key`** (\*): `string`</li></ul> |
| **`name`** (\*)        |                                                                                                      | `string`                                                            |
| **`description`** (\*) |                                                                                                      | `string`                                                            |
| **`address`** (\*)     |                                                                                                      | [Address](#address)                                                 |
| `openingHours`         | The opening hours of the pickup point, if applicable. This could be a string like "Mon-Fri 9am-5pm". | `string`                                                            |
| `contactPhone`         | The contact phone number for the pickup point, if applicable.                                        | `string`                                                            |
| `contactEmail`         | The contact email for the pickup point, if applicable.                                               | `string`                                                            |
| `instructions`         | Any special instructions for picking up from this point.                                             | `string`                                                            |

_(\*) Required._

## PriceIdentifier

_Object containing the following properties:_

| Property           | Type                                                  |
| :----------------- | :---------------------------------------------------- |
| **`variant`** (\*) | [ProductVariantIdentifier](#productvariantidentifier) |

_(\*) Required._

## Price

_Object containing the following properties:_

| Property                | Type                                         |
| :---------------------- | :------------------------------------------- |
| **`identifier`** (\*)   | [PriceIdentifier](#priceidentifier)          |
| **`unitPrice`** (\*)    | [MonetaryAmount](#monetaryamount)            |
| **`tieredPrices`** (\*) | _Array of [TieredPrice](#tieredprice) items_ |

_(\*) Required._

## ProductAttributeIdentifier

_Object containing the following properties:_

| Property       | Description                                      | Type     |
| :------------- | :----------------------------------------------- | :------- |
| **`key`** (\*) | The unique identifier for the product attribute. | `string` |

_(\*) Required._

## ProductAttribute

_Object containing the following properties:_

| Property              | Description                                                                                                   | Type                                                             |
| :-------------------- | :------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------- |
| **`identifier`** (\*) | The unique identifier for the attribute, also typically used as the facet key if the attribute is filterable. | [ProductAttributeIdentifier](#productattributeidentifier)        |
| **`group`** (\*)      |                                                                                                               | `string`                                                         |
| **`name`** (\*)       |                                                                                                               | `string`                                                         |
| **`values`** (\*)     |                                                                                                               | _Array of [ProductAttributeValue](#productattributevalue) items_ |

_(\*) Required._

## ProductAttributeValueIdentifier

_Object containing the following properties:_

| Property       | Description                                            | Type     |
| :------------- | :----------------------------------------------------- | :------- |
| **`key`** (\*) | The unique identifier for the product attribute value. | `string` |

_(\*) Required._

## ProductAttributeValue

_Object containing the following properties:_

| Property              | Description                                                                             | Type                                                                |
| :-------------------- | :-------------------------------------------------------------------------------------- | :------------------------------------------------------------------ |
| **`identifier`** (\*) | The unique identifier for the attribute value.                                          | [ProductAttributeValueIdentifier](#productattributevalueidentifier) |
| **`value`** (\*)      | The value of the attribute. Typically a language independent string                     | `string`                                                            |
| **`label`** (\*)      | The human friendly label for the attribute value. Typically a language dependent string | `string`                                                            |

_(\*) Required._

## ProductIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._

## ProductOptionIdentifier

_Object containing the following properties:_

| Property       | Description                                   | Type     |
| :------------- | :-------------------------------------------- | :------- |
| **`key`** (\*) | The unique identifier for the product option. | `string` |

_(\*) Required._

## ProductOption

_Object containing the following properties:_

| Property              | Description                                  | Type                                                       |
| :-------------------- | :------------------------------------------- | :--------------------------------------------------------- |
| **`identifier`** (\*) | The unique identifier for the option.        | [ProductOptionIdentifier](#productoptionidentifier)        |
| **`name`** (\*)       | The name of the option, e.g., Size or Color. | `string`                                                   |
| **`values`** (\*)     | A list of possible values for the option.    | _Array of [ProductOptionValue](#productoptionvalue) items_ |

_(\*) Required._

## ProductOptionValueIdentifier

_Object containing the following properties:_

| Property          | Description                                              | Type                                                |
| :---------------- | :------------------------------------------------------- | :-------------------------------------------------- |
| **`option`** (\*) |                                                          | [ProductOptionIdentifier](#productoptionidentifier) |
| **`key`** (\*)    | The value of the product option, e.g., "Red" or "Large". | `string`                                            |

_(\*) Required._

## ProductOptionValue

_Object containing the following properties:_

| Property              | Description                                            | Type                                                          |
| :-------------------- | :----------------------------------------------------- | :------------------------------------------------------------ |
| **`identifier`** (\*) | The unique identifier for the product option value.    | [ProductOptionValueIdentifier](#productoptionvalueidentifier) |
| **`label`** (\*)      | The human-friendly label for the product option value. | `string`                                                      |

_(\*) Required._

## ProductQueryById

_Object containing the following properties:_

| Property              | Type                                    |
| :-------------------- | :-------------------------------------- |
| **`identifier`** (\*) | [ProductIdentifier](#productidentifier) |

_(\*) Required._

## ProductQueryBySKU

_Object containing the following properties:_

| Property           | Type                                                  |
| :----------------- | :---------------------------------------------------- |
| **`variant`** (\*) | [ProductVariantIdentifier](#productvariantidentifier) |

_(\*) Required._

## ProductQueryBySlug

_Object containing the following properties:_

| Property        | Type     |
| :-------------- | :------- |
| **`slug`** (\*) | `string` |

_(\*) Required._

## ProductQueryVariants

_Object containing the following properties:_

| Property                     | Type                                    |
| :--------------------------- | :-------------------------------------- |
| **`parentId`** (\*)          | [ProductIdentifier](#productidentifier) |
| **`paginationOptions`** (\*) | [PaginationOptions](#paginationoptions) |

_(\*) Required._

## Product

A product is a wrapper around sellable items. It contains all the shared information for a set of SKUs. All products have at least one SKU, but can potentially have hundreds.

_Object containing the following properties:_

| Property                    | Description                                                                                               | Type                                                       | Default |
| :-------------------------- | :-------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------- | :------ |
| **`identifier`** (\*)       |                                                                                                           | [ProductIdentifier](#productidentifier)                    |         |
| **`name`** (\*)             | The name of the product                                                                                   | `string`                                                   |         |
| **`slug`** (\*)             | The URL-friendly identifier for the product                                                               | `string`                                                   |         |
| **`description`** (\*)      | A brief description of the product                                                                        | `string`                                                   |         |
| **`longDescription`** (\*)  | A detailed description of the product                                                                     | `string`                                                   |         |
| **`brand`** (\*)            | The brand associated with the product                                                                     | `string`                                                   |         |
| **`manufacturer`** (\*)     | The manufacturer of the product                                                                           | `string`                                                   |         |
| **`parentCategories`** (\*) | A list of parent categories the product belongs to                                                        | _Array of [CategoryIdentifier](#categoryidentifier) items_ |         |
| **`published`** (\*)        | Indicates whether the product is published and visible to customers                                       | `boolean`                                                  |         |
| **`sharedAttributes`** (\*) | A list of technical attributes associated with the product                                                | _Array of [ProductAttribute](#productattribute) items_     |         |
| **`options`** (\*)          | A list of options available for the product, such as size or color. Can be empty if product is single-sku | _Array of [ProductOption](#productoption) items_           |         |
| **`mainVariant`** (\*)      | The primary SKU for the product                                                                           | [ProductVariant](#productvariant)                          |         |
| `variants`                  | A list of all SKUs for the product. Can be empty or omitted if product is single-sku                      | _Array of [ProductVariant](#productvariant) items_         | `[]`    |

_(\*) Required._

## ProductSearchIdentifier

_Object containing the following properties:_

| Property                     | Description                                                | Type                                                           |
| :--------------------------- | :--------------------------------------------------------- | :------------------------------------------------------------- |
| **`term`** (\*)              | The search term used to find products.                     | `string`                                                       |
| **`facets`** (\*)            | The facets applied to filter the search results.           | _Array of [FacetValueIdentifier](#facetvalueidentifier) items_ |
| **`filters`** (\*)           | Additional filters applied to the search results.          | `Array<string>`                                                |
| **`paginationOptions`** (\*) | Pagination options for the search results.                 | [PaginationOptions](#paginationoptions)                        |
| `categoryFilter`             | An optional category filter applied to the search results. | [FacetValueIdentifier](#facetvalueidentifier)                  |

_(\*) Required._

## ProductSearchQueryByTerm

_Object containing the following properties:_

| Property          | Type                                                |
| :---------------- | :-------------------------------------------------- |
| **`search`** (\*) | [ProductSearchIdentifier](#productsearchidentifier) |

_(\*) Required._

## ProductSearchQueryCreateNavigationFilter

Payload to create a category navigation filter from a breadcrumb path.

_Object containing the following properties:_

| Property                | Description                                                                                  | Type                                   |
| :---------------------- | :------------------------------------------------------------------------------------------- | :------------------------------------- |
| **`categoryPath`** (\*) | An array representing the breadcrumb path to a category, from root to the specific category. | _Array of [Category](#category) items_ |

_(\*) Required._

## ProductSearchResultFacet

_Object containing the following properties:_

| Property              | Type                                                                             |
| :-------------------- | :------------------------------------------------------------------------------- |
| **`identifier`** (\*) | [FacetIdentifier](#facetidentifier)                                              |
| **`name`** (\*)       | `string`                                                                         |
| **`values`** (\*)     | _Array of [ProductSearchResultFacetValue](#productsearchresultfacetvalue) items_ |

_(\*) Required._

## ProductSearchResultFacetValue

_Object containing the following properties:_

| Property              | Type                                          |
| :-------------------- | :-------------------------------------------- |
| **`identifier`** (\*) | [FacetValueIdentifier](#facetvalueidentifier) |
| **`name`** (\*)       | `string`                                      |
| **`count`** (\*)      | `number`                                      |
| **`active`** (\*)     | `boolean`                                     |

_(\*) Required._

## ProductSearchResultItem

_Object containing the following properties:_

| Property              | Description                                                                                                                                                                                                                                                                                                                                                                                   | Type                                                                               |
| :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- |
| **`identifier`** (\*) |                                                                                                                                                                                                                                                                                                                                                                                               | [ProductIdentifier](#productidentifier)                                            |
| **`name`** (\*)       |                                                                                                                                                                                                                                                                                                                                                                                               | `string`                                                                           |
| **`slug`** (\*)       |                                                                                                                                                                                                                                                                                                                                                                                               | `string`                                                                           |
| **`variants`** (\*)   | A list of variants associated with the product in the search results. If exactly one is present, you can use add-to-cart directly from PLP. If none are present, you must direct to PDP. If mulitple are present, and no options are set, you must direct to PDP. If multiple are present, and they have options, you can render swatches on PLP and allow customer to flip between variants. | _Array of [ProductSearchResultItemVariant](#productsearchresultitemvariant) items_ |

_(\*) Required._

## ProductSearchResultItemVariant

_Object containing the following properties:_

| Property           | Description                                                   | Type                                                  |
| :----------------- | :------------------------------------------------------------ | :---------------------------------------------------- |
| **`variant`** (\*) | The specific variant of the product                           | [ProductVariantIdentifier](#productvariantidentifier) |
| **`image`** (\*)   | The image representing this variant in the search results     | [Image](#image)                                       |
| `options`          | The subset of options that can reasonably be applied on a PLP | [ProductVariantOption](#productvariantoption)         |

_(\*) Required._

## ProductSearchResult

_Object containing the following properties:_

| Property              | Description                          | Type                                                                   |
| :-------------------- | :----------------------------------- | :--------------------------------------------------------------------- |
| **`pageNumber`** (\*) | Current page number, starting from 1 | `number` (_≥1_)                                                        |
| **`pageSize`** (\*)   | Number of items per page             | `number` (_≥1_)                                                        |
| **`totalCount`** (\*) | Total number of items available      | `number` (_≥0_)                                                        |
| **`totalPages`** (\*) | Total number of pages available      | `number` (_≥0_)                                                        |
| **`items`** (\*)      |                                      | _Array of [ProductSearchResultItem](#productsearchresultitem) items_   |
| **`identifier`** (\*) |                                      | [ProductSearchIdentifier](#productsearchidentifier)                    |
| **`facets`** (\*)     |                                      | _Array of [ProductSearchResultFacet](#productsearchresultfacet) items_ |

_(\*) Required._

## ProductVariantIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`sku`** (\*) | `string` |

_(\*) Required._

## ProductVariantOption

_Object containing the following properties:_

| Property              | Description                                  | Type                                                |
| :-------------------- | :------------------------------------------- | :-------------------------------------------------- |
| **`identifier`** (\*) | The unique identifier for the option.        | [ProductOptionIdentifier](#productoptionidentifier) |
| **`name`** (\*)       | The name of the option, e.g., Size or Color. | `string`                                            |
| **`value`** (\*)      | The unique identifier for the option value.  | [ProductOptionValue](#productoptionvalue)           |

_(\*) Required._

## ProductVariant

_Object containing the following properties:_

| Property              | Description                                                     | Type                                                           |
| :-------------------- | :-------------------------------------------------------------- | :------------------------------------------------------------- |
| **`identifier`** (\*) | The unique identifier for the variant. Often its SKU            | [ProductVariantIdentifier](#productvariantidentifier)          |
| **`name`** (\*)       |                                                                 | `string`                                                       |
| **`images`** (\*)     | A list of images associated with the product variant            | _Array of [Image](#image) items_                               |
| **`ean`** (\*)        | The European Article Number identifier for the product variant  | `string`                                                       |
| **`gtin`** (\*)       | The Global Trade Item Number identifier for the product variant | `string`                                                       |
| **`upc`** (\*)        | The Universal Product Code identifier for the product variant   | `string`                                                       |
| **`barcode`** (\*)    | The barcode identifier for the product variant                  | `string`                                                       |
| **`options`** (\*)    | A list of option identifiers that define this variant           | _Array of [ProductVariantOption](#productvariantoption) items_ |

_(\*) Required._

## ProfileMutationAddShippingAddress

_Object containing the following properties:_

| Property              | Type                                      |
| :-------------------- | :---------------------------------------- |
| **`identifier`** (\*) | [IdentityIdentifier](#identityidentifier) |
| **`address`** (\*)    | [Address](#address)                       |

_(\*) Required._

## ProfileMutationMakeShippingAddressDefault

_Object containing the following properties:_

| Property                     | Type                                      |
| :--------------------------- | :---------------------------------------- |
| **`identifier`** (\*)        | [IdentityIdentifier](#identityidentifier) |
| **`addressIdentifier`** (\*) | [AddressIdentifier](#addressidentifier)   |

_(\*) Required._

## ProfileMutationRemoveShippingAddress

_Object containing the following properties:_

| Property                     | Type                                      |
| :--------------------------- | :---------------------------------------- |
| **`identifier`** (\*)        | [IdentityIdentifier](#identityidentifier) |
| **`addressIdentifier`** (\*) | [AddressIdentifier](#addressidentifier)   |

_(\*) Required._

## ProfileMutationSetBillingAddress

_Object containing the following properties:_

| Property              | Type                                      |
| :-------------------- | :---------------------------------------- |
| **`identifier`** (\*) | [IdentityIdentifier](#identityidentifier) |
| **`address`** (\*)    | [Address](#address)                       |

_(\*) Required._

## ProfileMutationUpdate

_Object containing the following properties:_

| Property              | Description                           | Type                                      |
| :-------------------- | :------------------------------------ | :---------------------------------------- |
| **`identifier`** (\*) |                                       | [IdentityIdentifier](#identityidentifier) |
| **`email`** (\*)      | The main contact email of the profile | `string` (_email_)                        |
| **`phone`** (\*)      | The main phone number of the profile  | `string`                                  |

_(\*) Required._

## ProfileMutationUpdateShippingAddress

_Object containing the following properties:_

| Property              | Type                                      |
| :-------------------- | :---------------------------------------- |
| **`identifier`** (\*) | [IdentityIdentifier](#identityidentifier) |
| **`address`** (\*)    | [Address](#address)                       |

_(\*) Required._

## ProfileQueryById

_Object containing the following properties:_

| Property              | Type                                      |
| :-------------------- | :---------------------------------------- |
| **`identifier`** (\*) | [IdentityIdentifier](#identityidentifier) |

_(\*) Required._

## Profile

_Object containing the following properties:_

| Property                     | Type                                      | Default |
| :--------------------------- | :---------------------------------------- | :------ |
| **`identifier`** (\*)        | [IdentityIdentifier](#identityidentifier) |         |
| **`email`** (\*)             | `string` (_email_)                        |         |
| **`phone`** (\*)             | `string`                                  |         |
| **`emailVerified`** (\*)     | `boolean`                                 |         |
| **`phoneVerified`** (\*)     | `boolean`                                 |         |
| **`createdAt`** (\*)         | `string`                                  |         |
| **`updatedAt`** (\*)         | `string`                                  |         |
| `shippingAddress`            | [Address](#address)                       |         |
| `billingAddress`             | [Address](#address)                       |         |
| `alternateShippingAddresses` | _Array of [Address](#address) items_      | `[]`    |

_(\*) Required._

## RegisteredIdentity

_Object containing the following properties:_

| Property        | Type                                      |
| :-------------- | :---------------------------------------- |
| **`id`** (\*)   | [IdentityIdentifier](#identityidentifier) |
| **`type`** (\*) | `'Registered'`                            |

_(\*) Required._

## RequestContext

_Object containing the following properties:_

| Property          | Description                                                                                                                | Type                                      | Default |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------- | :------ |
| `session`         | Read/Write session storage. Caller is responsible for persisting any changes. Providers will prefix own values             | [Session](#session)                       |         |
| `languageContext` | ReadOnly. The language and locale context for the current request.                                                         | [LanguageContext](#languagecontext)       |         |
| `storeIdentifier` | ReadOnly. The identifier of the current web store making the request.                                                      | [WebStoreIdentifier](#webstoreidentifier) |         |
| `taxJurisdiction` | ReadOnly. The tax jurisdiction for the current request, typically derived from the store location or carts billing address | [TaxJurisdiction](#taxjurisdiction)       |         |
| `correlationId`   | A unique identifier for the request, can be used for tracing and logging purposes.                                         | `string`                                  | `''`    |
| `isBot`           | Indicates if the request is made by a bot or crawler.                                                                      | `boolean`                                 | `false` |
| `clientIp`        | The IP address of the client making the request, if available. Mostly for logging purposes                                 | `string`                                  | `''`    |
| `userAgent`       | The user agent string of the client making the request, if available.                                                      | `string`                                  | `''`    |
| `referrer`        | The referrer URL, if available.                                                                                            | `string`                                  | `''`    |

_All properties are optional._

## Session

_Object record with dynamic keys:_

- _keys of type_ `string`
- _values of type_ `any`

## ShippingInstruction

_Object containing the following properties:_

| Property                                | Description                                                                                                                                                         | Type                                                  |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------- |
| **`shippingMethod`** (\*)               |                                                                                                                                                                     | [ShippingMethodIdentifier](#shippingmethodidentifier) |
| **`pickupPoint`** (\*)                  | An optional pickup point for the shipping method. This could be a physical store, a locker, or similar. If not set, it means home delivery to the shipping address. | `string`                                              |
| **`instructions`** (\*)                 | Optional instructions for the shipping. This could be delivery instructions, or similar.                                                                            | `string`                                              |
| **`consentForUnattendedDelivery`** (\*) | Indicates if the customer has given consent for unattended delivery, if applicable.                                                                                 | `boolean`                                             |

_(\*) Required._

## ShippingMethodIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._

## ShippingMethod

_Object containing the following properties:_

| Property                | Type                                                  |
| :---------------------- | :---------------------------------------------------- |
| **`identifier`** (\*)   | [ShippingMethodIdentifier](#shippingmethodidentifier) |
| **`name`** (\*)         | `string`                                              |
| **`description`** (\*)  | `string`                                              |
| `logo`                  | [Image](#image)                                       |
| **`price`** (\*)        | [MonetaryAmount](#monetaryamount)                     |
| **`deliveryTime`** (\*) | `string`                                              |
| `carrier`               | `string`                                              |

_(\*) Required._

## StoreIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._

## StoreQueryByProximity

_Object containing the following properties:_

| Property             | Type     |
| :------------------- | :------- |
| **`longitude`** (\*) | `number` |
| **`latitude`** (\*)  | `number` |
| **`distance`** (\*)  | `number` |
| **`limit`** (\*)     | `number` |

_(\*) Required._

## Store

_Object containing the following properties:_

| Property                     | Type                                                        |
| :--------------------------- | :---------------------------------------------------------- |
| **`identifier`** (\*)        | [StoreIdentifier](#storeidentifier)                         |
| **`name`** (\*)              | `string`                                                    |
| **`fulfillmentCenter`** (\*) | [FulfillmentCenterIdentifier](#fulfillmentcenteridentifier) |

_(\*) Required._

## TaxJurisdiction

_Object containing the following properties:_

| Property      | Type     | Default |
| :------------ | :------- | :------ |
| `countryCode` | `string` | `'US'`  |
| `stateCode`   | `string` | `''`    |
| `countyCode`  | `string` | `''`    |
| `cityCode`    | `string` | `''`    |

_All properties are optional._

## TieredPrice

_Object containing the following properties:_

| Property                   | Description                                                        | Type                              |
| :------------------------- | :----------------------------------------------------------------- | :-------------------------------- |
| **`minimumQuantity`** (\*) | The minimum quantity required to be eligible for the tiered price. | `number`                          |
| **`price`** (\*)           | The monetary amount for the tiered price.                          | [MonetaryAmount](#monetaryamount) |

_(\*) Required._

## WebStoreIdentifier

_Object containing the following properties:_

| Property       | Type     |
| :------------- | :------- |
| **`key`** (\*) | `string` |

_(\*) Required._
