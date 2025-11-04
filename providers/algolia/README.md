# Algolia provider for Reactionary

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
The expected Algolia schema must contain at least these fields

```json
{
  objectID: string;
  slug:string;
  name: string;
  variants: [
    { 
      variantID: string; 
      image: string;
    }
  ]
}
```

You can have more, for use with facets, and additional searchable fields, but these must be in the index, and constitutes what we are expecting to get back.

The `objectID` corrosponds to your productIdentifier, and `variantID` should match your SKU


## Building

Run `nx build provider-algolia` to build the library.

## Running unit tests

Run `nx test provider-algolia` to execute the unit tests via [Jest](https://jestjs.io).
