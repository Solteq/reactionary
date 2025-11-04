# Product data

Reactionary uses a Product/Variant model for product data.

The product is the carrier of organizational data (`seoslug`, `parentCategory`, etc), and shared marketing data `description`, `sharedAttributes`, etc.

All products will have at least one variant.  Variants represent the buyable version of the product, or more commonly called the `SKU`.

It is mainly when navigating to the PDP you will need to load the product directly.



## Navigating to the PDP
The PDP will be accessible by seo slug. From talking to our internal PIM people, it is apparent that virtually noone expects to be able to have a product-description seperate from all its variants, so for that reason, the assumption is that when you look at a PDP, you are looking at the Product + one of its variants.

The `Product` model has a `.mainVariant` sub-field that contains the variant specific information (`sku`, `ean`, `name`, `images` etc)

There is no guarantees which variant (if you have multiple) that will be returned in the call to `ProductProvider#getBySlug`.

If you want to allow navigating to a specific variant, you have to add your own url-scheme that includes the `sku`. This would typically be, if you want to persist your attribute selection to the url, so customer can copy/paste url and send to someone.

```ts
// assume route contains the current url..
const product = await client.product.getBySlug({ slug: route.url }, reqCtx);

// product.description
// product.mainVariant.images[0].sourceUrl

```

## Get SKU
If you need to show some data for your cart items, or checkout items, you can use the `ProductProvider#getBySKU` call. It will return a `Product`, but with the `mainVariant` set to the variant with the `sku` you passed as argument.

```ts
for(const item of cart.items) {
  const product = await client.product.getBySKU({ variant: item.variant });
  // product.mainVariant has the SKU of the item now..
  // product.mainVariant.images[0].sourceUrl
}
```

## Getting category information for breadcrumbs or megamenus
You use the `CategoryProvider#getBreadcrumbPathToCategory` to get the full navigational path from a products parent category to the root of the site.

```ts
const breadcrumb = await client.category.getBreadcrumbPathToCategory({ id: product.parentCategories[0] });
```

To render site menus, you can use this call
```ts
const topCategories = await client.category.findTopCategories({ paginationOptions: { pageNumber: 1, pageSize: 15 }});
```

Note, both for topCategories and childCategories you have to use pagination options. By design, we do not allow for unbounded calls. The maximum pageSize is 50, but the recommended pageSize is 20. 
On some sites you might WANT to load everything in one go, but it should be considered a code-smell. Why would the customer want to wait to load 1000 categories. He can't reasonably do anything with it anyway.




## Specializing the product
When you get to know your project and customers domain, you will want to add logic to make the domain model more specialized to your field.
This helps make the code easier to read later on.

See `basic-node-provider-model-extension.spec.ts` for an example of how to do this.

It is *highly* recommended that you take the time to do this. 

```ts
  const PharmacyProductSchema = ProductSchema.extend({
    // if true, the product is an RX product, and cant be buyable unless you have a prescription
    isPrescriptionProduct: z.boolean().default(false)
  });
  type PharmacyProduct = z.infer<typeof PharmacyProductSchema>;

  class PharmacyProductProvider extends MedusaProductProvider<PharmacyProduct> {

    protected override parseSingle(_body: StoreProduct, reqCtx: RequestContext): T {
      const model = super.parseSingle(body);

      if (_body.metaData['rx-product'] === 'true') {
        model.isPrescriptionProduct = true;
      }
      return this.assert(model);
    }
  }
```


## Design decisions
Since , in some frameworks, the entirety of the object can be serialized between BFF and Client, we have decided not to include a list of all variants directly on the `Product` model. 

The products identifier is meaningless, and no semantic meaning is assigned to it, except it should be something that is very unlikely to change in the upstream PIM

## FAQ about products

### Why cant i get a full product with all variants in one call
Because virtually no usecase needs it. For rendering a PDP, you need the shared product data, the focused-variant, and a list of all the options that can be selected.
Only when customer completes a selection, do you need to go find the SKU data.

### What about B2B scenarios where i might have many many skus?
In some B2B Scenarios, there may be 50 variants, shown as a list rather than a attribute-picker. This is facilitated by the `ProductProvider#getSKUList` which is a paginated service. You should aim to load this lazily on the client if possible.

