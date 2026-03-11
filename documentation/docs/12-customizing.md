# Customizations

Reactionary is made to be customizable at many different levels. It is expected that each project will have some very basic customizations, made in order to make the object model fit the domain you are working in.
This could, for instance, be creating a `MyCustomerProduct` that extends `Product` by pulling out all the semantic attributes from the general key-value pair, and apply some logic to them during instantiation.

Or it could be changing the `add-to-cart` functionality by passing additional fields to the server

Or it could be adding a new provider of an existing capability (like getting inventory from ERP)

Or it could be adding an entirely new capability, specific to your project


All these options are supported and first class citizens.


## Customizing data models

Imagine a project with a pharmacy customer. Your product might have some attributes that tell if this is an prescription-only product or not, and it might need to take into account whether you are above 15 for some products, again based on basic attributes.

You could do the whole project doing things like `product.sharedAttributes.find(x => x.name === 'isRx') ?? false` but, if your data model ever changes, this means you have to go an fix this a million places.

Instead, it is recommended to make `isRx` a first class citizen of your projects `Product` class.

All types are defined as Zod schemas, to ensure we can apply validation and verification both.
```ts
const PharmacyProductSchema = ProductSchema.safeExtend({
  isRx: z.boolean().default(false),
  isOtc: z.boolean().default(false),
  isMedicine: z.boolean().default(false)
});

export type PharmacyProduct = InferType<PharmacyProductSchema>;
```
Note, your extension fields must have a default value, or be optional. 

What we did here, was to define a new schema, for how products look. Specifically, we say we want it to have a few non-optional boolean field that indicates if this is an medical drug or not.


To take advantage of this, we then have to extend the Factory class. Each capability has its own factory, that converts from the provider-specific format to reactionarys model. 

```ts
// in our example project, we are building on commercetools, so we extend that product factory to 
// convert from Commercetools representation to our project representation
class PharmacyCommercetoolsProductFactory extends CommercetoolsProductFactory<typeof PharmacyProductSchema> {
  constructor() {
    super(PharmacyProductSchema);
  }

  public override parseProduct(    
    context: RequestContext,
    data: ProductProjection,
  ): z.output<TProductSchema> {

    const base = super.parseProduct(context, data);
    const atcCode = base.sharedAttributes.find(x => x.name === 'atcCode');

    base.isDrug = !!atcCode;
    base.isRx =  base.sharedAttributes.find(x => x.name === 'isRx' );
    base.isOtc = base.isDrug && !base.isRx;
   
    // remove isRx from attributes..
    const consumedAttributes = ['isRx', 'atcCode'];
    base.sharedAttributes = base.sharedAttributes.filter(x =>  consumedAttributes.some(x.name))

    return this.productSchema.parse(result);
  }
}
```

Finally, to make the system use the new factory class, find your initialization function and

```ts
...
  .withCapability(
    withCommercetoolsCapabilities(config, {
      ...
      product: {
        enabled: true,
        factory: new PharmacyCommercetoolsProductFactory(),
      },
      ...
    }),
  )
  .build();
```
This will now process all incoming full-product requests, and return the new type. 
This means everywhere the capability returns a product, it now returns a pharmacy-product.


```ts
   const product = await client.product.getBySlug({ slug: 'penicillin-4mg'});
   // product is now a PharmacyProduct
   console.log(product.isRx); // prints true...
```



## Changing an operation on a capability

You can customize both Query and Mutation operations.

Imagine a scenario in which you must customize the product search, to accept an extra field as part of the on-site experience, and this turns into between 1 and 3 extra filters at runtime. 

First you expand the query payload schema, like so:
```ts

// if isRx is set on the product, it must be returned int he search...
// in this scenario we are not letting the customer pick when they are included, but rather react 
// to other things in his session and page.
const PharmacyProductSearchQueryByTermSchema = ProductSearchQueryByTermSchema.safeExtend({
  includeRx: z.boolean().default(false),
});

export type PharmacyProductSearchQueryByTerm = InferType<PharmacyProductSearchQueryByTermSchema>;
```

Next you will need to extend the `Capabiltiy` of the projects provider (in this case Commercetools).
Generally, in `Reactionary`, all fetch or update functions have an extension point, that allows you to manipulate the payload before the call goes out.

The naming convention is, <functionName>Payload. So, if your operation is called `queryByTerm`, the extension point is called `queryByTermPayload`, and takes the same parameters as the actual function.

Generally, it is preferable to do the customziations in that function, because allows the caller logic to follow the reactionary upgrade path. But it /is/ fully valid to take full control of the call, if you need to. You are then not expected to call `super.<functionName>` to avoid future behavioral impacts from reactionary.

```ts
class PharmacyCommercetoolsProductSearchCapability extends CommercetoolsProductSearchCapability<CommercetoolsProductSearchFactory> {

// we do all the outgoing payload customization here...
  protected override async queryByTermPayload(payload: PharmacyProductSearchQueryByTerm) {
    const basePayload = super.queryByTermPayload(payload);

    if (payload.includeRx) {
      // commercetools specific syntax, unverified. Example is by human. Check for errors.
      basePayload.filters.push('isRx:true');
    }
    return payload;
  }

  // While we dont CHANGE the behavior of this call, we override it anyway, in order to allow the type-inference
  // to report back the right type for developer assistance/type-checking.
  public override queryByTerm(payload: PharmacyProductSearchQueryByTerm) {
    super.queryByTerm(payload);
  }
}
```


Finally, you wire the new Capability up in the client initialization like so:

```ts
...
  .withCapability(
    withCommercetoolsCapabilities(config, {
      ...
      product: {
        enabled: true,
        capability: ({ cache, context, config, commercetoolsApi }) =>
          new PharmacyCommercetoolsProductSearchCapability(
            cache,
            context,
            config,
            commercetoolsApi,
            new CommercetoolsProductFactory(ProductSchema)
          ),
      },
      ...
    }),
  )
  .build();
```

The updated query payload is now a first class citizen in your entire project. Meaning, you will get type-ahead assistance with field names, linter issues for refactoring, and crucially, no `as XXX ` casts anywhere.

So to use
```ts
  const resultPageResponse = await client.productSearch.queryByTerm({
    term: formData.searchTerm,
    facets: [],
    paginationOptions: {
      pageNumber: 1,
      pageSize: 10,
    },
    filters: [],
    includeRx: false,
  })
```


### FAQ about customizations

#### "Why", you may ask, couldn't you just add the filter directly at this point? 
Because its not a random filter field. It's a domain expression of a business condition you need to make sure is being addressed everywhere. Specifically, you will probably be using the productSearch for other kinds of calls, than purely PLP entries. And you want to guarantee in your project, that whomever makes a call to the product search, has considered whether to include rx products in the potential result set, or not.

