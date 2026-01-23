# Meilisearch provider for Reactionary

## Supports


| Feature | Support | Notes |
| -----------   | ----------- | --------- |
| product       | Full      |          |
| productSearch | Full     |  |
| identity | N/A     | |
| cart |  N/A     |  |
| checkout | N/A     |  |
| order | N/A    | Possibly later |
| inventory | N/A     |  |
| price | N/A  |  |
| category | N/A     | Possibly later |
| store | N/A    | Possibly later |


## Notes
The expected Meilisearch schema must contain at least these fields

```json
{
  id: string;
  slug:string;
  name: string;
  variants: [
    { 
      sku: string; 
      image: string;
    }
  ]
}
```

You can have more, for use with facets, and additional searchable fields, but these must be in the index, and constitutes what we are expecting to get back.

The `id` corresponds to your productIdentifier, and `sku` should match your SKU


## Building

Run `nx build provider-meilisearch` to build the library.

## Running unit tests

Run `nx test provider-meilisearch` to execute the unit tests via [Jest](https://jestjs.io).
