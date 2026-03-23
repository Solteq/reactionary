# Dealing with carts and checkouts

## Carts
In Reactionary, you can have many concurrent carts. They can be a mix of b2b and b2c carts. The storefront is responsible for the lifecycles of each cart.

### Getting active cart
There isn't really a concept of an active cart. Many sites will probably be happy with just picking the most recently changed cart for this kind of semantic, but conceptually you can have 3 carts equally open.

To get the list of carts, and maybe the active cart for a context (b2c) do

```ts
const listResponse = await client.cart.listCarts(payload: { paginationOptions: { pageNumber: 1, pageSize: 10 }});

if (!listResponse.success) {
  return Response(500, 'unable to receive list of carts')
}

if (listResponse.value.items.length > 0) {
  activeCartId = listResponse.value.items[0].identifier;
} 
```
You would not create a dummy/placeholder cart at this point. Wait to do that, until the customer actually interacts with the cart, ie try to add something to it.

### Adding to cart
When adding to cart, you want to first be sure you have a cart to add something to.
As we want to allow you to have multiple carts open and accessible at one time, you have to explicitly create the cart. 
As a guest user, you can only create b2c carts. As a registered user, you can, if the site permits, and you have the rights, create b2b carts as well.

```ts

// assume, that we are an addToCart server side function called from the PDP
const variantIdentifier = formData['variantId']
const qty = Number(formData['qty'])

if (!activeCartId) {
  const createCartResponse = await client.cart.createCart({
    name: 'Optional name'  // can be skipped. 
  });

  if (!createCartResponse.success) {
    return Response(500, 'Unable to create cart');
  }
  activeCartId = createCartResponse.value.identifier;
}

const addToCartResponse = await client.cart.add({
   cart: cartIdentifier,
   variant: variantIdentifer,
   quantity: 1,
})

if (!addToCartResponse.success) {
  return Response(500, `Unable to add ${variantIdentifier.sku} to cart` )
}
```





## Design decision
It was decided to adopt a pattern where the cart is not the thing that you check out. Rather the cart is the data entity responsible for recording your product selections, and calculating your price.

When you want to start the checkout process, you create a new checkout session, based on your cart, at which point the cart is considered read-only.

While we have seen examples of cart pages where you can change quantity, remove items, or add upsells up until the second you press "pay", the new style of checkout focuses on getting you to pay, as fast as possible.

This means, you can have all the upsell stuff on the "review cart page", but once you decide to "go to checkout", the focus is "Where, and how are you paying".


## Initiating checkout
The checkout takes as input a cart, any billing address you might have from being logged in, and returns a different object.

```ts
  const checkoutResponse = await client.checkout.initiateCheckoutForCart({
    cart: cart.value,
    billingAddress: address,
    notificationEmail: email,
    notificationPhone: phone,
  });
  if (!checkoutResponse.success) {
      throw new Response("Error initiating checkout " + checkout.error, { status: 500 });
  }

  const routeId = checkoutResponse.value.identifier.key;

```
UI wise you can consider these values tied to this checkout, so its perfectly fine to have a flow where the address is edited later on. This is just the seed address/the billing address that allows us to make informed decisions about the kind of taxes and shipping you are going to be presented with.

The checkout's id can then be used on your frontend url scheme to refer to this checkout session.


## Setting a shipping address
Depending on your flow, you might ask for a seperate shipping address (if not set, the billing address is assumed as the shipping address as well). 
The shipping address might affect the ways in which you can get things shipped, so maybe set this before picking the shipping provider.

```ts
const shippingAddress = {...} satisifes Address;
const updatedCheckoutResponse = await client.checkout.setShippingAddress({ checkout: { key: routeParams.checkoutId }, shippingAddress: shippingAddress });

if (!updatedCheckoutResponse.success) {
    throw new Response("Error setting shipping address on checkout " + checkout.error, { status: 500 });
}
```


## Setting a shipping instruction
A shipping instruction is to shipping like a payment instruction is to payment. It is the combined set of choices that define how this order is requested delivered. Ie, the method, the pickup point, and any instructions you might have for the carrier.

To get the list of available shipping methods use

```ts
// lets double check that the checkout still exists...
const checkout = await client.checkout.getById({ identifier: { key: checkoutId || "" } });
if (!checkout.success) {
    throw new Response("Checkout Not Found", { status: 404 });
}

const availableShippingMethodsResponse = await client.checkout.getAvailableShippingMethods({ checkout: checkout.value.identifier})
if (availableShippingMethodsResponse.success) {
  const availableShippingMethods = availableShippingMethodsResponse.value;
  console.log(availableShippingMethods[0])
}

```
Once picked, you can then set the full shipping instruction

```ts
  const formData = await request.formData();

  const selectedMethod = formData.get("shippingMethod") as string;
  const shippingInstructions = formData.get("shippingInstructions") as string;
  const allowUnattendedDelivery = formData.get("allowUnattendedDelivery") === "on";


// verify the checkout wasn't deleted in the mean time and that you can access it
  const checkout = await client.checkout.getById({ identifier: { key: checkoutId || "" } });
  if (!checkout.success) {
      throw new Response("Checkout Not Found", { status: 404 });
  }

  const shippingInstruction: ShippingInstruction = {
      shippingMethod: { key: selectedMethod },
      instructions: shippingInstructions,
      pickupPoint: "",
      consentForUnattendedDelivery: allowUnattendedDelivery,
  }
  console.log('Selected shipping method in action:', shippingInstruction);
  const updatedCheckout = await client.checkout.setShippingInstruction({
    checkout: checkout.value.identifier,
    shippingInstruction: shippingInstruction,
  });
  if (!updatedCheckout.success) {
    throw new Response("Error setting shipping instruction", { status: 500 });
  }
```

## Setting payment instruction
A payment instruction consist of a choice of payment provider, and the amount of money to ask to authorize.
A checkout can have multiple payment instructions. Sometimes for complicated purchases (use multiple credit cards, or some from mobilepay and rest on creditcard), or for more mundane purposes, like applying store-credit, or using an electronic gift-card.

To get a list of available payment methods do something like 
```ts
    const checkoutId = params.checkoutId;
  // verify the checkout wasn't deleted in the mean time and that you can access it
    const checkout = await client.checkout.getById({ identifier: { key: checkoutId || "" } });
    if (!checkout.success) {
        throw new Response("Checkout Not Found", { status: 404 });
    }
    const paymentMethodResponse = await client.checkout.getAvailablePaymentMethods({
      checkout: { key: checkoutId || "" },
    });
    if (!paymentMethodResponse.success) {
      throw new Response("Error fetching payment methods", { status: 500 });
    }
    const paymentMethods = paymentMethodsResponse.value;

```
Add UI to display, and once picked, apply to checkout.

```ts
 const checkoutId = params.checkoutId;
  const formData = await request.formData();

  const selectedMethod = formData.get("paymentMethod") as string;

  const session = await getSession(request.headers.get("Cookie"));
  const reqCtx = await createReqContext(request, session);
  const client = await createClient(reqCtx);

  const checkout = await client.checkout.getById({ identifier: { key: checkoutId || "" } });
  if (!checkout.success) {
      throw new Response("Checkout Not Found", { status: 404 });
  }
  const paymentMethods = await client.checkout.getAvailablePaymentMethods({
    checkout: checkout.value.identifier,
  });
  if (!paymentMethods.success) {
    throw new Response("Error fetching payment methods", { status: 500 });
  }

  const paymentMethod = paymentMethods.value.find(
    (method) => String(method.identifier.method) === selectedMethod
  );
  if (!paymentMethod) {
    throw new Response("Invalid Payment Method", { status: 400 });
  }


  const updatedCheckout = await client.checkout.addPaymentInstruction({
    checkout: checkout.value.identifier,
    paymentInstruction: {
      paymentMethod: paymentMethod.identifier,
      amount: checkout.value.price.grandTotal,
      protocolData: [],
    },  
  });
  if (!updatedCheckout.success) {
    throw new Response("Error adding payment instruction", { status: 500 });
  }
```

At this point, your backend will have set up a payment intent with the PSP, and you can read out the data needed to either load the providers UI library and bootstrap it (stripe), or you will get a redirect url you can use to send the customer to the payment processor directly.

In this example, we detect that we 
```ts
  const pendingPayment = updatedCheckout.value.paymentInstructions.find(x => x.status === 'pending');
  if (pendingPayment?.paymentMethod.paymentProcessor === 'stripe') {
    return redirect(`/checkout/${checkoutId}/payment/stripe`);
  }
```

And on that subpage specifc to stripe, you might extract hte client secret required to feed their component.

```ts
  const clientSecretData = pendingPayment.protocolData.find(
    (data) =>
      data.key === "stripe_clientSecret" || data.key === "client_secret",
  );
```


Finally, when the payment provider either returns (because you punched out, and provided a return url with the `checkoutId` in it), OR the inline component tells you everything is fine, it is time to close the deal

```ts
    const checkoutId = params.checkoutId;
    const checkout = await client.checkout.getById({
      identifier: { key: checkoutId || "" },
    });

    if (!checkout.success) {
        throw new Response("Checkout Not Found", { status: 404 });
    }
    const finalizedCheckoutResponse = await client.checkout.finalizeCheckout({ checkout: checkout.value.identifier })

```
The checkout returned, contains the state of things as they were at checkout. It also has a reference to the created order. Wheter you want your order confirmation to be based on either is project dependent. In some setups the order might come from a secondary OMS system, and it might take a while for the order to exist there. 

## FAQ

### When you say the cart is readonly, what does that mean for the UX flow?
Whether or not the cart is ACTUALLY read only doesn't matter. The point is, that changes to cart during checkout session is not automatically reflected into the checkout. This ensures you don't need to deal with situations where customer has opened two browser windows and try to add more stuff to the cart during checkout.

The Checkout session contains all you need to render the UX flow. It has a snapshot of the carts contents at the time you initiated the login.




