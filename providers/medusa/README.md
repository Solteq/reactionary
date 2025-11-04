# Medusa provider for Reactionary

## Supports

| Feature | Support | Notes |
| -----------   | ----------- | --------- |
| product       | Full  (*)      | Mandatory customization to support lookup by sku          |
| productSearch | Partial     | No facets in medusa search |
| identity | Planned     | |
| cart | Full     |  |
| checkout | In progress     |  |
| order | Planned     |  |
| inventory | Planned     |  |
| price | Planned   |  |
| category | Planned     |  |
| store | Planned    |  |


## Notes
Medusa is expected to be version 2.11+


## Workarounds in place
Medusa needs an Admin key, to be able to do the following things
- Resolve product by SKU.

Since medusa can't search and filter on `sku`, you have to import the value for `sku` into `barcode`, `ean` or `upc`. Either will do.
The assumption is, that your SKU is either an semi-internal erp dictated partnumber, OR the products `gtin`.


