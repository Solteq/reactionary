# Adding product search

A common pattern on most ecommerce sites, is to allow the user to search / navigate your catalog. For this purpose Reactionary provides the `ProductSearchProvider`. 


## Keyword search
You can react to the user submitting a keyword search, or maybe routing to a special landing page where the page-part is a search term, by doing something like this

```ts
const searchresult = await client.productSearch.queryByTerm(
    {
      search: {
        facets: [],
        paginationOptions: {
          pageNumber: 1,
          pageSize: 12,
        },
        term: 'glass',
        filters: []
      },
    },
    reqCtx
  );
```
What you get back is a miniturazed/specialized product model, optimized for PLP purposes. 

In the Product/Variant mindset, the search returns Products, with enough of each variant to make it identifiable. Ie Image and SKU.
In addition, the variant part might also contain an indexed `Option`, which can be used to create swatches on the PLP if needed.

The result of the search is a paged result set, but with some added fields for `facets`

So, to iterate you would do something like

```ts
{
  const prices = await client.price.getBySKUs( searchResult.items.map(x => return { variant: x.variant[0].variant } ), requestContext);
  searchResult.items.map((product) => {
        const imgUrl = product.variants[0].image[0].sourceUrl || 'assets/no-image.png'
        const imgAlt = product.variants[0].iamge[0].altText || product.name;
        const price = prices.find(x => x.variant.sku === product.variants[0].variant.sku )
        return (
          <div className={classnames("card")} key={product.identifier.key} sku={product.variants[0].variant.sku}>
            <img
              className={classnames("card__image")}
              src={imgUrl}
              alt="{imgAlt}"
            />
            <h5 className={classnames("card__title")}>{product.name}</h5>
            <p>{price.value} {price.currency}</p>
            <p className={classnames("card__desc")}>{product.description}</p>
            if (product.directAddToCart) {
              <button className={classnames("card__button")}>Add to Cart</button>
            } else {
              <button className={classnames("card__button")}>View variants</button>
            }
          </div>
        );
      })}
}
```


Facets can be rendered in the same way. When a customer clicks a facet, you can redo the existing search, with that facet selected, because the original searchresult has the query information it was made for, as part of it.

```ts
// customer has clicked some facet-valie, and we are passed its identifier. The identifier should be considered opaque at this point...

const existingSearchState = mySession.lastKeywordSearch;

const updatedFacets = [...existingSearchState.facets, newlyClickedFacetValue];
const paginationOptions = { ...existingPaginationOptions, pageNumber: 1 };

// keep everything in our search the same, except add the new facet, and reset to page 1.
const newSearchQuery = { search: { ...existingSearchState, facets: updatedFacets, paginationOptions };
const newSearchState = client.productSearch.queryByTerm(newSearchQuery, requestContext);

mySession.lastKeywordSearch = newSearchState.identifier;
```

The above example shows how the responsibility for state management is split between the UX framework and Reactionary. Reactionary has no insight into the routing patterns or page transitions that may have occured, and have no way of knowing if we are in a continuous interaction on the same search or not. 

### Swatches / Variants on PLP

Generally, for sites that are Mobile first, or where the vast majority of interaction is expected to come from mobile devices, anything that becomes fiddly, should be avoided. It is hard for users to click one of 12 color swathes on your 400x200 product tile, without accidentially clicking the product itself.

But in some cases, where desktop is still the expected primary channel, you might want to add some indication that a product exists in various variations.

To do this, the data model provides one `ProductVariantOption` pr variant from the search index.

Note, that the search index Variants is expected to be a subset of the `Product` model variants. And only for the visually distinct variations.
So, if your `Product` has 6 sizes (XXL through XS), and 5 colors (red, green, blue, yellow, black), your Product Model might have 30 variants. But your search index should only have 5, one for each color, as this is the visually distinctive set for this product.

If your product has 20 variants, differing on some attribute `Length` or `Diameter`, those are not really good candidates for search index variations as they are not visually distinct. In this case the search index would contain only one variation, but, it would be marked as not directly addable to cart (`ProductSearchResultItemSchema#directAddToCart`).







## Typeahead
TBD



## Design
We consider category navigation just a special case of facetted filtering. Therefore, no dedicated function is available to do keyword search vs category search.

We may later decide to add a category version, if only to make it easier to seperate the analytics of them both.

The Variant of the SearchResultItem is set to only have one option, as that is what we see most frequently on sites. 
These design patterns are well served under the current model:

1. Products have 1 SKU, you can click Add to cart directly from PLP
1. Products have multiple SKUs, you click tile, and get sent to PDP
1. Products have multiple SKUs with one visually discerning attribute, you can click Add to cart directly from PLP
1. Products have multiple SKUs,with one visually discerning attribute, and one or more non-visual. You click tile and gets sent to PDP with attribute selected
1. Products have multiple SKUs, with no discerning attributes. You click tile and get sent to PDP

The only pattern that isn't well supported is
1. Products have multiple SKUs with multiple visually discerning attribute, you can click Add to cart directly from PLP

It is felt that this is rare enough, that we can make that a specialization task if it comes up.
