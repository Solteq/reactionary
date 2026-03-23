# B2B Commerce (Work In Progress)

The way B2B Commerce is implemented in reactionary, is that all primary elements that are ownable by either a person or a company, all have a `create` operation that takes an optional `CompanyIdentifier`.

This is the only way to create an item in context of a company. When you call these things without a `company` parameter, you are creating a personal owned entity instead.

This goes for 
- Carts
- ShoppingLists
- RequestForQuotes


Other entities have optional `company` modifiers to their queries, allowing for company-specific values to be returned and potentially cached.

This covers
- Price / CustomerPrice
- Order-search


## Carts
For instance, to create a new cart, for a company you have some role in, you do

```ts
const companyCartResponse = await client.cart.createCart({
  company: myCompanyIdentifier
});

if (!companyCartResponse.success) {
  return Response(500, 'Unable to create the cart. Are you sure you have a role in this company');
}

// this is also a place to get some info....
console.log(companyCartRespose.value.company);
```

From here you use the cart you normally would.

```ts
const addToCartResponse = await client.cart.add({
  cart: companyCartRespose.value.identifier,
  variant: {
    sku: 'SKUA1234',
  },
  quantity: 1
});
```

As always its important that you treat the cart identifier as a opaque entity, and don't start picking it apart for session storage, or form-submissions. Always json-derser the whole thing if you need it as a string representation at some point.

You cannot reassign a cart from one company to another. If you want to do that, create a new cart in the other company, then copy over all rows and other data.


You can get a list of open carts for an organization by 
```ts
const listCartsForCompany = await client.cart.listCarts({
  search: {
    company: myCompanyIdentifier, 
    paginationOptions: {
      pageNumber:1,
      pageSize: 10
    }
  }
})
```

This will return the list of carts associated with that company. If you want a list of personal carts, do

```ts
const listCartsForMe = await client.cart.listCarts({
  search: {
    paginationOptions: {
      pageNumber:1,
      pageSize: 10
    }
  }
})
```
This returns all your b2c carts.

## Prices
In B2B you can run in two pricemodes:
- Prices managed and hosted in the ecom backend
- Prices hosted in the ERP (external prices)

For ERP mode, you will most likely have to provide a project specific override to the Price Capability in which you perform a REST call to whatever endpoint you have that can resolve the price info. This way, all the display logic stays the same, but when adding to cart, you will the push the price in as a customPrice.

The backend is expected to accept this at face value, but confirm it once the cart turns into a checkout, and again after checkout is complete.

That way, it becomes transparent to the frontend code where the price comes from, and what happens to it.
Worst case, the customer manages to "hack" the frontend to make it look like he gets a better price, but in the end the validation will stop the order from being placed, so he is only wasting his own time.

To get prices, that are specific to your company, pass the company identifier to the getCustomerPrice query.

```ts
const myCompanyPrice = client.price.getCustomerPrice({
    variant: { sku: testData.skuWithoutTiers },
    company: myCompanyIdentifier;
})
```

## Orders
You can find and search for orders that belong to your company by providing the company filter.

```ts
const ordersForMyCompany = await client.orderSearch.queryByTerm({
        search: {
          term: searchTerm,
          company: myCompanyIdentifier,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 10,
          },
          filters: [],
        },
      });
```

As with carts, if you do not provide a company, you are searching only for B2C orders. And if you DO provide company, you are searching in the set of orders related to that company.


## Shopping lists
You can create requisition lists or other types of list, in your company context, the same way you create carts.

```ts
  const requisitionListForMyCompany = await client.productList.addList({
    company: myCompanyIdentifier,
    list: {
      type: 'requisition',
      name: 'My Requisition list',
      published: true,
    },
  });
```

And to get a list of all requisiiton lists in that company that you can interact with
```ts
const allReqListsResponse = await client.productList.queryList({
  search: {
    company: myCompanyIdentifier,
    listType: 'requisition',
    paginationOptions: {
      pageNumber: 1,
      pageSize: 25,
    },
  },  
})
```

## Products
Some setups, require that b2b customers have their own, sometimes restricted, assortment.
In this kind of setup, your frontend will most likely only allow interacting with one company at a time.

But, you can ask to search for products that belong to your companys assortment, by adding the company filter on the product search.

```ts
const myCompaniesProducts = await client.productSearch.queryByTerm({
  search: {
    term: searchTerm,
    company: myCompanyIdentifier,
    paginationOptions: {
      pageNumber: 1, 
      pageSize: 10
    } 
  }
});
```
This will apply whatever filtering is appropriate to the search result, ensuring you only get results back you are entitled to.


## Checkout
During checkout, the frontend should check the Company settings, and see if it should allow address entry at all (`isCustomAddressesAllowed === true`), or if it should just only the company shipping addresses as selectable.
You should assume the backend will enforce it with some error or other, if you don't adhere to this.



### Design decision
Reactionary does not require you to add company-id to getProductByXXX because it is assumed that if you know the sku, you are probably allowed to see it. This could be for old orders, etc.


