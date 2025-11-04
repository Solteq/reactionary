# Commmercetools provider for Reactionary

## Supports


| Feature | Support | Notes |
| -----------   | ----------- | --------- |
| product       | Full      |          |
| productSearch | Full     |  |
| identity | Full     | |
| cart | Full     |  |
| checkout | Full     |  |
| order | Full     |  |
| inventory | Full     |  |
| price | Full   |  |
| category | Full     |  |
| store | Full    |  |


## Notes











## Building

Run `nx build provider-commercetools` to build the library.

## Running unit tests

Run `nx test provider-commercetools` to execute the unit tests via [Jest](https://jestjs.io).


## Assumptions for backend config

- You will have 2 different channels for prices, one called `Offer Price` and one called `List Price`
- ProductVariants will all have unique SKU values.
- Your Supply Channels double as Store Locations



## TODO List

### Core
- [ ] Figure out if we are actually running as anonymous user towards CT. It feels weird right now.

### Price
- [ ] PriceProvider should be able to use both embedded and standalone prices? Possible by querying through product-projection maybe?
- [ ] If not, using product-projection, the logic in https://docs.commercetools.com/api/pricing-and-discounts-overview#price-selection should be replicated
- [ ] add list price by convention. Like key: LP-<sku> or something.


### Inventory
- [ ] Be traced and cached




