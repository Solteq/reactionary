# Adding the personal touch

Reactionary supports many mechanisms by which to make the customer journey unique to a customer. The main mechanism is via the `ProductRecommendationsProvider` which offers 7 unique ways to find some relevant products to display for the user.

It is assumed, that any basic-direct-assign logic (ie editor has picked 4 products to show) is already handled at the CMS level. The Reactionary provider is for the usecase where you want a dynamic result back, based on the users behavior, tags, or whatever you have.

The supported algorithms are

```
- Frequently-Bought-Together (Product based)
- Trending-In-Category (Category based)
- Similar (Product)
- Related-Items (Product)
- Popular-Products (User)
- Top-Picks-For-You (User)
- Also-Viewed (Product, User)
```

Reactionary supports having multiple providers of product recommendations, each of which will be asked in order, until the result is fully populated. 
Every provider might not support every algorithm though.

But, the point of this is, that you can either hardcode something on the PDP

```ts
const recommendations = client.productRecommendations.getRecommendations({
  algorithm: 'similar',
  numberOfRecommendations: 8,
  labels: [ 
    (
      isLoggedIn: 'Registered' : 'Guest',
      registeredThisSession? 'FirstSession': 'ReturningCustomer', 
      customerSegments.map(x => x.name), 
      new Date().getHour() > 12? "Afternoon": "Morning",
      getTemperatureAround(context.clientIp) < 20: 'Cold': 'Warm' 
    )
  ]
});

if (recommendations.success)  {
  // we can now resolve them
const allProducts = Promise.all(
    recommendations.value.products.map(x => client.product.getByID(x)).map(x => x.successs? x.value : null )).filter(y => !!y);
  // and draw them...
}
```

Instead of using the full `client.product` you could have resolved it via the `.productSearch` to get a smaller data-footprint. However, since you are hopefully just about to navigate to one of these pages, it might be better for overall cache performance to use the full data model.




## Collections

Some systems offer named access to a potentially rules based selection of products. An example is the HCL Commerce espot system, where your frontpage migth have a spot called "Newest arrivals", and behind the scenes some rules engine decides what to show there.

It can also be simply the name of a CMS entity, or other system specific functionality.

You can call that as well here:

```ts
const recommendations = client.productRecommendations.getCollection({
  collectionName: 'newest-arrivals',
  numberOfRecommendations: 8,
  labels: [ 
    (
      isLoggedIn: 'Registered' : 'Guest',
      registeredThisSession? 'FirstSession': 'ReturningCustomer', 
      customerSegments.map(x => x.name), 
      new Date().getHour() > 12? "Afternoon": "Morning",
      getTemperatureAround(context.clientIp) < 20: 'Cold': 'Warm' 
    )
  ]
});

if (recommendations.success)  {
  // we can now resolve them
const allProducts = Promise.all(
    recommendations.value.products.map(x => client.product.getByID(x)).map(x => x.successs? x.value : null )).filter(y => !!y);
  // and draw them...
}
```

### Configuration
Since not every system can provide every recommendation algorithm, Reactionary supports enabling this capability on multiple providers.

So if you have both algolia and medusa, you can set `productRecommendations: true` on both, and the system will then ask each system in turn until the required number of results have been gathered.



## Design decisions
Since not all systems can deliver full product data back, we are initially only returning the IDs of the products, so you have to use the `product` provider to resolve it into something displayable.

Later, we might add a discriminator, allowing the same bare-bones/tile-ready data to be returned from this, as is returned from the product search.

It was also decided to have the source and target unit be a product (Forest Ranger T-Shirt), and not the individual sku (Forest Ranger T-Shirt, Yellow, Size-32).

This is from emperical studies showign that you will get more results from the toplevel product, than from a rarely used SKU.

