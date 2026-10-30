/**
 * What each tool does, written for the agent that has to choose and call it, by `<capability name>.<method name>`.
 *
 * The field level descriptions come from the input schemas. These say what the operation is for, how it fits with the other
 * tools, and the details of its input that an agent cannot see in the schema: which value comes from which other tool, which
 * fields have to be sent even when there is nothing to put in them, what an empty result means.
 *
 * A description set with `@Reactionary({ description })` on a method wins over these. Keep them to what the operation
 * does, and to what was checked against the schemas and the providers. Where providers differ the text says so or leaves it out.
 */
export const TOOL_DESCRIPTIONS: Readonly<Record<string, string>> = {
  // Cart
  'cart.getActiveCartId':
    'Returns the key of the cart of the current session. Fails with NotFound when the session has no cart yet: then create one with cart.createCart. Takes no input.',
  'cart.createCart':
    'Creates an empty cart for the current session and returns it, with its key in identifier.key. Optional: a name for the cart, and a company (B2B). Items are added with cart.add.',
  'cart.getById':
    'Returns a cart with its items, quantities, prices and applied promotions. Input: cart, the cart identifier exactly as returned by cart.getActiveCartId, cart.createCart or another cart tool. Do not rebuild it from the key alone, some providers also need a version.',
  'cart.add':
    'Adds a product variant to an existing cart and returns the updated cart with recalculated prices. The cart must exist: use cart.getActiveCartId, or cart.createCart when there is none. The variant is identified by its SKU (variant.sku, from the product tools). quantity defaults to 1 and must be at least 1. Check the returned items to see how the provider treated a SKU that was already in the cart.',
  'cart.changeQuantity':
    'Sets the quantity of one cart item and returns the updated cart. item.key is the identifier.key of an item in the cart, not a SKU. The quantity must be at least 1: to remove an item use cart.remove.',
  'cart.remove':
    'Removes one item from the cart and returns the updated cart. item.key is the identifier.key of an item in the cart, not a SKU.',
  'cart.applyCouponCode':
    'Applies a coupon code to the cart and returns the updated cart with recalculated prices. The provider decides whether the code is valid for the cart: check the returned promotions.',
  'cart.removeCouponCode': 'Removes a coupon code from the cart and returns the updated cart with recalculated prices.',
  'cart.changeCurrency':
    'Changes the currency of the cart, using a three letter ISO 4217 code such as EUR, and returns the cart with its prices recalculated.',
  'cart.renameCart': 'Gives the cart a new name, which makes it easier to tell carts apart when a customer has several. Returns the cart.',
  'cart.deleteCart':
    'Deletes the cart, or empties it on providers that cannot delete a cart. The session then has no active cart until a new one is created. Returns nothing.',
  'cart.listCarts':
    'Lists the carts of the current customer, optionally of one company, a page at a time. Send search.paginationOptions, which may be empty. Providers that support one cart per customer return that cart.',

  // Categories
  'category.findTopCategories':
    'Lists the categories without a parent, a page at a time, for building a top menu. Send paginationOptions, which may be an empty object (page 1, 20 per page).',
  'category.findChildCategories':
    'Lists the child categories of a category, a page at a time. parentId.key is the identifier.key of the parent category. Send paginationOptions, which may be an empty object.',
  'category.getById': 'Returns a category by its id.key. Fails with NotFound when there is no such category.',
  'category.getBySlug': 'Returns a category by its SEO slug, the part of a category URL that names it. Fails with NotFound when there is no such category.',
  'category.getBreadcrumbPathToCategory':
    'Returns the categories from the root down to the given one, root first, for showing a breadcrumb. id.key is the identifier.key of the category.',

  // Products
  'product.getById': 'Returns a product with its description, attributes, options and variants. Input: identifier.key of a product, from a search result.',
  'product.getBySlug': 'Returns a product by its URL slug, with its description, attributes, options and variants. Fails with NotFound when there is no such product.',
  'product.getBySKU':
    'Returns the product that a variant (SKU) belongs to, with all its variants. Input: variant.sku. Use it to go from a SKU in a cart, an order or a list to the product.',
  'product-search.queryByTerm':
    'Searches the catalogue and returns one page of products with facets for narrowing the search. Send search.term (use "" to list products without a search word; "*" is only understood by some providers), search.facets and search.filters (both required: send empty arrays when not narrowing), and search.paginationOptions (required, may be empty: page 1, up to 50 per page, 20 by default). To narrow, send facet values taken from the facets of an earlier result in search.facets; send search.filters as [] (on some providers filters are raw expressions). Some providers return no facets. Search results are summaries: get the full product with product.getById.',
  'product-search.createCategoryNavigationFilter':
    'Turns the breadcrumb path of a category (the result of category.getBreadcrumbPathToCategory) into a filter that product-search.queryByTerm takes as search.categoryFilter, to list the products of that category and the ones below it.',
  'product-search.resolveCategoryFromKey':
    'Looks up the category that a search key refers to and returns its id, key and localized names. Input: key.',
  'product-associations.getAccessories':
    'Returns products that are accessories of a product, such as a case for a phone, as configured for the product in the catalogue. Input: forProduct.key and numberOfAccessories (1 to 12). May return fewer than asked for.',
  'product-associations.getSpareparts':
    'Returns products that are spare parts of a product. Input: forProduct.key and numberOfSpareparts (1 to 12). May return fewer than asked for.',
  'product-associations.getReplacements':
    'Returns products that replace a product, equivalent or newer ones. Input: forProduct.key and numberOfReplacements (1 to 12). May return fewer than asked for.',
  'product-recommendations.getRecommendations':
    'Returns recommended products for one of several algorithms. algorithm selects how: frequentlyBoughtTogether, similar and related need sourceProduct; trendingInCategory needs sourceCategory; popular and topPicks need no source. Providers support only some of the algorithms. numberOfRecommendations is 1 to 12. The result may hold fewer.',
  'product-recommendations.getCollection':
    'Returns the products of a named collection, a curated list or a marketing zone. Input: collectionName and numberOfRecommendations (1 to 12); sourceProduct and sourceCategory give context. A collection the provider does not have gives a NotFound error or an empty list.',
  'product-reviews.getRatingSummary':
    'Returns the average rating of a product, the number of ratings and, where the provider has it, how many ratings each of 1 to 5 got. Input: product.key.',
  'product-reviews.findReviews':
    'Returns a page of the reviews of a product, with author, rating, title, text and whether the purchase was verified. Input: product.key, and optionally paginationOptions.',
  'product-reviews.submitReview':
    'Posts a review of a product for the customer. Input: product.key, rating (1 to 5), title, content and authorName. Changes data: only call it when the customer has asked to post this review.',
  'price.getCustomerPrice':
    'Returns the price that applies to the current customer for a variant: unit price and whether it is on sale, and on some providers tiered prices by quantity. A SKU the provider does not know may come back with a placeholder unit price of -1 instead of an error. Input: variant.sku, and company.taxIdentifier for a B2B customer (not every provider uses it). Use this price when showing or quoting a price.',
  'price.getListPrice':
    'Returns the list price of a variant, the general price without any customer specific discount, as the "before" price. Input: variant.sku. For the price the customer pays use price.getCustomerPrice.',
  'inventory.getBySKU':
    'Returns how many units of a variant are available at a fulfilment centre and the stock status: inStock, outOfStock, onBackOrder, preOrder or discontinued. Input: variant.sku and fulfilmentCenter.key. The key is spelled fulfilmentCenter in the input, and fulfillmentCenter in the result. Take the key from store.list (fulfillmentCenter.key of a store) for the stock at that store; the key of the online fulfilment centre is a setting of the shop.',

  // Stores
  'store.list': 'Lists the stores of the brand, a page at a time, with name, address, opening hours and the fulfillmentCenter.key that inventory.getBySKU needs. Send paginationOptions, which may be an empty object.',
  'store.getById': 'Returns one store by its identifier.key: name, address, opening hours and fulfillmentCenter.key.',
  'store.queryByProximity':
    'Returns the stores within a distance of a position. Input: latitude and longitude in degrees, distance (the largest distance to a store, in kilometres) and limit (the most stores to return).',

  // Checkout
  'checkout.initiateCheckoutForCart':
    'Starts a checkout for a cart and returns it, with the checkout key in identifier.key that the other checkout tools take. Input: cart, the whole cart object, not a key: pass the result of cart.getById exactly as it was returned, because the cart cannot be sent without its identifier and user (items, price and the rest are filled in when left out, but send them as returned). Providers use only cart.identifier.key from it. Optional: billingAddress (it is also used as the shipping address until checkout.setShippingAddress is called), notificationEmail and notificationPhone. After this, treat the cart as read-only. Only start a checkout when the customer has asked to check out.',
  'checkout.getById':
    'Returns a checkout: items, prices, addresses, the shipping instruction, the payment instructions and, when it has been placed, the key of the resulting order in resultingOrder. Input: identifier.key of the checkout.',
  'checkout.setShippingAddress':
    'Sets the shipping address of a checkout, recalculates the available shipping methods and the totals, and returns the checkout. Input: checkout.key and shippingAddress with firstName, lastName, streetAddress, streetNumber, city, region, postalCode and countryCode (a two letter code), all required.',
  'checkout.getAvailableShippingMethods':
    'Lists the shipping methods that can be used for a checkout, with name, price, delivery time, carrier and whether it is a delivery or a pickup. They depend on the shipping address, so set it first. Input: checkout.key. identifier.key of a method is what checkout.setShippingInstruction takes.',
  'checkout.setShippingInstruction':
    'Records how the order is shipped and returns the checkout. Input: checkout.key and shippingInstruction with shippingMethod.key (from checkout.getAvailableShippingMethods), and pickupPoint, instructions and consentForUnattendedDelivery, which are required: send "" for pickupPoint and instructions and false for consent when they do not apply. pickupPoint is a carrier service point; for pickup at one of the brand\'s stores set store.key (from store.list) instead. With neither, the order is delivered to the shipping address.',
  'checkout.getAvailablePaymentMethods':
    'Lists the payment methods that can be used for a checkout, which depend on the billing address and jurisdiction. Input: checkout.key. Each identifier (method, name, paymentProcessor) is what checkout.addPaymentInstruction takes.',
  'checkout.addPaymentInstruction':
    'Adds a payment to the checkout and returns the checkout. Input: checkout.key and paymentInstruction with amount (value and currency) and paymentMethod, copied from the identifier of a method of checkout.getAvailablePaymentMethods, and protocolData (send [] when there is none). A payment provider usually needs the customer to complete the payment in its own page or form, so the payment is not done when this returns: check the checkout before finalizing.',
  'checkout.removePaymentInstruction':
    'Removes a payment from the checkout (not implemented by every provider, the Medusa provider fails), which usually cancels the payment started at the payment provider, and returns the checkout. Input: checkout.key and paymentInstruction.key.',
  'checkout.finalizeCheckout':
    'Places the order from the checkout and returns the checkout, with the key of the order in resultingOrder. It fails when the checkout is not ready, for example when a payment has not been completed, and then no order is created. Input: checkout.key. Only call it when the customer has asked to place the order, and only report an order as placed when resultingOrder is set.',

  // Orders
  'order.getById': 'Returns an order with its items, prices, addresses and the status of each item. Input: order.key, the resultingOrder of a finalized checkout or the identifier of an order from order-search.queryByTerm.',
  'order-search.queryByTerm':
    'Searches orders and returns a page of order summaries with date, status and total. Input: search with term (required, the text to look for), paginationOptions and filters (both required: send filters: [] and paginationOptions: {} when there is nothing to filter), and optionally partNumber, orderStatus, user, startDate, endDate and company. Get the full order with order.getById.',

  // Identity and profile
  'identity.getSelf': 'Returns who the current session is: Anonymous, Guest, or Registered with the userId. Takes no input. The userId is what the profile tools take as identifier.userId.',
  'identity.login':
    'Signs the customer in with a username (the email address) and password, and returns the identity of the session. Changes the session: the cart of the session may change with it. Only call it with credentials the customer has given for this purpose.',
  'identity.logout': 'Signs the customer out and returns the new identity of the session, which is Anonymous. Takes no input.',
  'identity.register':
    'Creates an account with a username (the email address) and password, signs it in, and returns the identity of the session. Changes data: only call it when the customer has asked to create an account.',
  'identity.listProviders':
    'Lists the ways the customer can sign in: each with an identifier, a display name and a flow, credentials (username and password with identity.login) or redirect (an external identity provider, with identity.startExternalLogin). Takes no input.',
  'identity.startExternalLogin':
    'Begins a sign-in with an external identity provider. Input: provider.key (from identity.listProviders) and callbackUrl, where the provider sends the customer back. Returns location, the address the customer has to be sent to; the sign-in ends with identity.completeExternalLogin.',
  'identity.completeExternalLogin':
    'Finishes a sign-in with an external identity provider from what it sent to the callback address. Input: provider.key, callbackUrl and callbackParameters, the query parameters it appended. Returns the identity of the session.',
  'profile.getById':
    'Returns the profile of a registered customer: email, phone, name, shipping addresses and billing address. Input: identifier.userId, from identity.getSelf.',
  'profile.update': 'Updates the email, phone and name of a profile and returns it. Input: identifier.userId, email and phone (both required) and optionally firstName and lastName.',
  'profile.addShippingAddress':
    'Adds a shipping address to a profile and returns the profile. Input: identifier.userId and address. It does not become the default address on its own: use profile.makeShippingAddressDefault.',
  'profile.updateShippingAddress': 'Changes a shipping address of a profile, the one with the same address.identifier.nickName, and returns the profile. Input: identifier.userId and address.',
  'profile.removeShippingAddress':
    'Removes a shipping address from a profile and returns the profile. Input: identifier.userId and addressIdentifier.nickName. When it was the default address, another address becomes the default.',
  'profile.makeShippingAddressDefault': 'Makes one of the shipping addresses of a profile the default one and returns the profile. Input: identifier.userId and addressIdentifier.nickName.',
  'profile.setBillingAddress':
    'Sets the billing address of a profile and returns the profile. There is one billing address per profile, and this replaces it. Input: identifier.userId and address.',
  'personalization-profile.getPersonalizationProfile':
    'Returns the marketing profile of a visitor, with segments and affinities, which recommendations and search can use to personalize their results. Input: identity (from identity.getSelf) and optionally profile.',

  // Product lists
  'product-lists.queryLists':
    'Lists the product lists of the customer of one type: favorite, wish, requisition or shopping. Input: search.listType and search.paginationOptions (which may be empty), and optionally search.company. Use it to find out whether a list exists before adding to it.',
  'product-lists.getById': 'Returns a product list by its identifier: listType and key, and user for lists of a user.',
  'product-lists.addList': 'Creates a product list, for example a wish list, and returns it. Input: list with type (favorite, wish, requisition or shopping) and name, and optionally description, image, published and publishDate.',
  'product-lists.updateList': 'Changes the name, description, image or publishing of a product list and returns it. Input: list (listType and key) and the fields to change.',
  'product-lists.deleteList': 'Deletes a product list with all its items. Input: list (listType and key). Returns nothing. Only call it when the customer has asked to delete the list.',
  'product-lists.queryListItems': 'Lists the items of a product list, a page at a time. Input: search.list (listType and key) and search.paginationOptions, which may be empty.',
  'product-lists.addItem': 'Adds a product variant to a product list and returns the item. Input: list (listType and key) and listItem with variant.sku and quantity (required), optionally notes and order.',
  'product-lists.updateItem':
    'Changes the quantity, notes or position of an item of a product list and returns it. Input: listItem (key, and the list it is in) and the fields to change.',
  'product-lists.deleteItem': 'Removes an item from a product list. Input: listItem.key and the list it is in. Returns nothing.',

  // Taxonomy
  'taxonomy.getVocabulary':
    'Returns a vocabulary, a named set of concepts such as features or categories, as a tree of its concepts with names in the language of the request. Input: vocabulary.key.',
  'taxonomy.getConcepts':
    'Returns concepts by their identifiers, with names in the language of the request. Concepts that do not exist are left out of the result. Input: concepts, a list of objects with a key, such as [{"key":"..."}].',
  'taxonomy.getRelatedConcepts': 'Returns the concepts around concepts: their broader concepts (ancestors), narrower concepts (descendants) and related concepts.',
  'taxonomy.expandConcepts':
    'Expands concepts, usually the concepts of a product, to the concepts around them with a weight: the concepts themselves, their narrower and related concepts and their ancestors. Sorted by weight, at most 2000. It is the context that taxonomy.rankByConcepts ranks against.',
  'taxonomy.expandAffinities':
    'Expands the interests of a visitor (the affinities of the personalization profile) to concepts with a weight, the way taxonomy.expandConcepts does. Only the highest affinities count. The result is personal data and is never cached.',
  'taxonomy.rankByConcepts':
    'Ranks items, such as articles, by the concepts they share with a context, optionally reordered by the interests of the visitor. Nothing is fetched. Fails with InvalidInput for negative weights, a strength outside 0 to 1, or more than 2000 concepts in the context or the affinities.',

  // B2B: companies, employees, invitations
  'company.getById': 'Returns a company: name, contact, billing address, shipping addresses and what the company is allowed to manage itself. Input: identifier.taxIdentifier.',
  'company.listCompanies': 'Lists the companies the current user may act for, a page at a time. Input: search.paginationOptions, which may be empty.',
  'company.addShippingAddress': 'Adds a shipping address to a company (when the backend allows it) and returns the company. Input: company.taxIdentifier and address.',
  'company.updateShippingAddress': 'Changes a shipping address of a company (when the backend allows it), the one with the same address.identifier.nickName, and returns the company. Input: company.taxIdentifier and address.',
  'company.removeShippingAddress':
    'Removes a shipping address of a company (when the backend allows it) and returns the company. Input: company.taxIdentifier and addressIdentifier.nickName. When it was the default address, another one becomes the default.',
  'company.makeShippingAddressDefault': 'Makes a shipping address of a company the default one (when the backend allows it) and returns the company. Input: company.taxIdentifier and addressIdentifier.nickName.',
  'company-registration.requestRegistration':
    'Asks for a new company to be registered and returns the request, with its key and status (pending, approved or denied). Depending on the backend the company can only be used once the request is approved. Changes data: only call it when the customer has asked to register the company.',
  'company-registration.checkRequestStatus': 'Returns the status of a company registration request: pending, approved or denied, with a comment when there is one. Input: requestIdentifier.key.',
  'employees.listEmployees': 'Lists the employees of a company, a page at a time, optionally filtered by email, name or role. Input: search.company, search.paginationOptions (which may be empty), and the filters.',
  'employees.getByEmail': 'Returns the employee of a company with an email address: name, role and spending limit. Input: company.taxIdentifier and email.',
  'employees.assignRole': 'Gives an employee a role (admin, manager or employee) and returns the employee. Input: company.taxIdentifier, employeeIdentifier.userId and role. Changes permissions.',
  'employees.unassignRole': 'Takes a role (admin, manager or employee) away from an employee and returns the employee. Input: company.taxIdentifier, employeeIdentifier.userId and role. Changes permissions.',
  'employees.removeEmployee': 'Removes an employee from a company. Input: company.taxIdentifier and employeeIdentifier.userId. Returns nothing. Only call it when asked to.',
  'employee-invitation.inviteEmployee':
    'Invites a person by email to join a company with a role (admin, manager or employee) and returns the invitation, with its status, how long it is valid and its security token. Input: company.taxIdentifier, email and role.',
  'employee-invitation.listInvitations': 'Lists the invitations to join a company, a page at a time, optionally for one email address. Input: search.paginationOptions (which may be empty), and optionally search.company and search.email.',
  'employee-invitation.acceptInvitation':
    'Accepts an invitation to join a company, for the person it was sent to, and returns the invitation. Input: invitationIdentifier.key, securityToken (from the invitation) and currentUserEmail, which has to be the invited address.',
  'employee-invitation.revokeInvitation': 'Withdraws an invitation so that it can no longer be accepted. Input: invitationIdentifier.key. Returns nothing.',
};
