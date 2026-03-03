# Product lists
Reactionary supports multiple different kinds of product-lists that a user can own.
Functionally they /may/ differ on the server side of things, but mostly they definetly differ in the user journey a user takes
to interact with one.

The list types supported are:
- Favorite lists: For smashing a star/heart icon on a PLP, and either be able to view from my account, or be used by marketeer to boost/notify you when items go on sale 
- Wish lists: For gathering different product sets for different parts of the family. Can be used by marketeers to notify you when items go on sale
- Requisition lists: mostly for b2b. Reusable/recurring order basis
- Shopping lists: Weekly/Daily/topical list of products for easy re-ordering or sharing with familiy.

Under one heading we call these `product lists`

Most providers will allow you to have any number of each type. And each provider may have different backend uses and features for each type. 

## Reacting to the user adding something to a requisition list
A typical workflow is that a user comes to the PDP, sees something that he needs to add to a requisiton list for a project he is planning.

So we have to fetch a list of all the requisition lists he can see. In B2B this may exceed the ones he made for himself.

```ts
const requisitionListResponse = await client.productList.queryList({
  search: {
    listType: 'requisition',
    paginationOptions: {
      pageNumber: 1,
      pageSize: 25,
    },
  },  
})

if (requisitionListResponse.success) {
  ...
}
```

These might then be iterated and shown in a dropdown box, allowing customer to pick which project to use, or optionally create a new. When the code submits, it either contains the name of the new list or the identifier of the existing.

```ts
function formSubmit({ existingListId?: ProductListIdentifier, newList?: name, variant: ProductVariantIdentfier }: formData) {
  let listId: ProductListIdentifier | undefined = existingListId;
  if (newList) {
    const result = await client.productList.addList({
      list: {
        type: 'favorite',
        name: newList,
        published: true,
      },
    });
    if (!result.success) {
      return Response(500, result.error);
    }
    listId = result.value.identifier;
  } 


  // ok, we have now ensured we have  the list created...we can add the item.
  const addResult = await client.productList.addItem({
    list: listId,
    listItem: {
      variant: variant,
      quantity: 1,
      notes: 'Added on ' + (new Date()).toLocalDate(),
      order: 0,
    },
  });
  if (!addResult.success) {
    return Response(500, addResult.error, 'Unable to add item to requisition list')
  }
  return Toast('Item added to requisition list')
}
```


## Showing the requisition list items
Later, in the My Account section, we might show a table of all the items on the requisition list

```ts
  const pageOfItemsResponse = await client.productList.queryListItems({
    search: {
      list: list.identifier,
      paginationOptions: {
        pageNumber: 1,
        pageSize: 10,
      },
    },
  });
  if (!pageOfItemsResponse.success) {
    return Response(404);
  }

  // use this to show a table. Add pagination
```

## Updating the quantity or comments of an item
Assuming your UI allows it, the customer can change the quantity or other item level data.

```ts

async function updateItemQuantity(newQty: number, listItemIdentifier: ProductListItemIdentifier) {
  const updatedItemResponse = await client.productList.updateItem({
    listItem: listItemIdentifier,
    quantity: 5,
  })
  if (!updatedItemResponse.success) {
    return Response(500, updatedItemResponse.error)
  }  
}
```
At this point, the result will contain the updated item. So you can replace it back in the set of items that are in the current rendering context, or, you can just fetch the current page of items again.

## Removing an item from a list
You can remove an item from the list by doing something like

```ts
const removeItemResponse = await client.productList.removeItem({
  listItem: listItemIdentifier
})
```


## Refining the header data
You can allow the customer to add name and detailed description to the product list itself. This can be updated using this

```ts
const updateList = await client.productList.updateList({
  list: listIdentifier,
  description: 'Lorem ipsum dolor......',
  published: false
})
```

While we say, that all list-types have a `published` and `publishDate` field, not all providers tie any semantics to them.
Some might decide that an `unpublished` requisitionlist, is only viewable by the author, and not the rest of the office.
An `unpublished` wishlist is one under consideration. Once published, it would be viewable on some SEO-based url to everybody, on or after the `publishDate`.
Point is, you might have to simulate the behavior yourself, depending on the active backend.


## Design decisions
Since the usage pattern of product lists are often to show list info first, and only infrequently the actual items, a two-stage model has been chosen for reactionary. Ie, "pick a wish list to add to", "pick a requisition list to add to, or type a name to create a new".

This means you do not get the items, along side the name/header information of the list. Instead, a seperate set of functions allow you to list and manipulate the items. 

This allows us to handle large lists, like requisition lists with 500 items, in a meaningful way, without having to load every single thing for every interaction.

The list item is sparse, meaning it only contains the product variant identifier. Like with cart items, you must then use the `product` capabiltiy to resolve this into an actual item to show.  The guess, right now, is that caching will make this managable. 

