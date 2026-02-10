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

## Analytics

The Algolia analytics provider maps the following tracked event types to data tracked in Algolia:

- AnalyticsMutationProductSummaryViewEvent => ViewedObjectIDs
- AnalyticsMutationProductSummaryClickEvent => ClickedObjectIDsAfterSearch / ClickedObjectIDs
- AnalyticsMutationProductAddToCartEvent => AddedToCartObjectIDsAfterSearch / AddedToCartObjectIDs
- AnalyticsMutationPurchaseEvent => PurchasedObjectIDs

The `AfterSearch` variants are (with the exception of purchase) preferred by the provider in the cases where Algolia is the source of the events. For search or recommendation this would typically be the case, but not necesarily for users arriving on a PDP as a direct target from a search or a link.

Note that we do not map `PurchasedObjectIDsAfterSearch` as it would require us to persist the search query ID that lead to the add-to-cart occuring on the cart items. This currently seems like an excess burden to impose on the cart interface. 

The `ConvertedObjectIDs` and `ConvertedObjectIDsAfterSearch` are not mapped as they seem superfluous by all accounts in a product-purchase based flow. They could likely be used for other types of conversions in a more general setup, such as a customer finishing reading an article.

Finally the events that are related to filtering are not mapped, as they are by all accounts deprecated and no longer influence any of the recommendation or personalization features.