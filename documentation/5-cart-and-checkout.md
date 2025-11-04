# Dealing with carts and checkouts





# Design decision
It was decided to adopt a pattern where the cart is not the thing that you check out. Rather the cart is the data entity responsible for recording your product selections, and calculating your price.

When you want to start the checkout process, you create a new checkout session, based on your cart, at which point the cart is considered read-only.

While we have seen examples of cart pages where you can change quantity, remove items, or add upsells up until the second you press "pay", the new style of checkout focuses on getting you to pay, as fast as possible.

This means, you can have all the upsell stuff on the "review cart page", but once you decide to "go to checkout", the focus is "Where, and how are you paying".


## FAQ

### When you say the cart is readonly, what does that mean for the UX flow?
Whether or not the cart is ACTUALLY read only doesn't matter. The point is, that changes to cart during checkout session is not automatically reflected into the checkout. This ensures you don't need to deal with situations where customer has opened two browser windows and try to add more stuff to the cart during checkout.

The Checkout session contains all you need to render the UX flow. It has a snapshot of the carts contents at the time you initiated the login.


