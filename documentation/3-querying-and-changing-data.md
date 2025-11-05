# Querying and Changing data

All reactionary calls take an object-based parameter set, and the `RequestContext` in which the call is made.
For getters, this object is called a Query, and for functions that change state, they are called Mutations. This is the chosen termnology.

The naming convention states, that your query must be called
`<Noun>Query<NameOfQuery>Schema`

We strive to have all queries be named for what they constrain the dataset by, making the most frequent pattern `<Noun>QueryBy<Fields>Schema`

Examples of this are (Query)
```ts
export const CategoryQueryBySlugSchema = BaseQuerySchema.extend({
    slug: z.string().default(''),
});
```


Other variations exist where the Query has mulitple parameters
```ts
export const CategoryQueryForChildCategoriesSchema = BaseQuerySchema.extend({
    parentId: CategoryIdentifierSchema.default(() => CategoryIdentifierSchema.parse({})),
    paginationOptions: PaginationOptionsSchema.default(() => PaginationOptionsSchema.parse({})),
});
```

Likewise for changing data, you will see that the mutator object has a nameing convention of `<Noun>Mutation<Operation>Schema`, example

```ts
export const CartMutationItemAddSchema = BaseMutationSchema.extend({
    cart: CartIdentifierSchema.nonoptional(),
    variant: ProductVariantIdentifierSchema.nonoptional(),
    quantity: z.number()
});
```



## Paging
All getters that return lists, are by design paginated, with a maximum of 50 items returned pr page.

All pages are indexed with 1 being the first page. This makes it easier to render, and since Reactionary provides all the relevant numbers, you are not really expected to do math on the data yourself.

Pagination options are always set as a nested object on the Query, called `paginationOptions`, and the result object, always reflects both `pageNumber`, `pageSize`, `totalCount` and `totalPages` back out.




## Design Decisions
We want all aspects of Reactionary to be custommizable and extendable. It is for this reason, we are using the object-payloads for parameters, as this allows you to specialize and extend the query for your own purpose, without violating any of the underlying mechanisms.

Ie, if your site operated on mulitple catalogs, and you needed to load some catalog specific information in the `getBySlug` call, you can add the extra query parameters by extending the `CategoryQueryBySlugSchema`, and likewise for mutations, if you need to send more data to `add-to-cart`, you can extend the `CartMutationtemAddSchema`.


All data and parameters is validated by `Zod` on the recieving end. This means, we adhere to the schema definitions very strictly, and you will get runtime errors if you provide bad or faulty data. This is intentional, as it requires you to fix the data, or fix your logic when certain invariants are not met. While this might seem annoying at first, it helps make things alot more maintainable over time, and has the added benefit of incentivising data-integrity checks at more levels.


To ensure you also get compile time errors you can use the `satisfies` construct.

ie
```ts
const clickedCategory = <the id of the category the user just clicked>
const childCategories = client.category.findChildCategories({
  parId: clickedCategory,
  paginationOptions: {
    pageNumber: 1,
    pageSize: 40
  }
} satisfies CategoryQueryForChildCategories)
```

this will give a compile time error that the `parentId` is missing.

