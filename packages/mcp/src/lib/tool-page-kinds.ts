/**
 * The kinds of page of a shop that a tool is useful on. A client that offers tools per page, like a browser with WebMCP,
 * can offer the tools of the page the customer is on and leave out the rest, which keeps the list an agent chooses from short.
 *
 * - `any`: useful on every page
 * - `product`: a product page
 * - `listing`: a category page or a search result
 * - `cart`: the cart
 * - `checkout`: the checkout
 * - `account`: the pages of a signed in customer: profile, orders, lists
 * - `order`: an order and the order history
 * - `store`: a store locator
 * - `b2b`: the pages of a business customer: company, employees
 */
export type ToolPageKind = 'any' | 'product' | 'listing' | 'cart' | 'checkout' | 'account' | 'order' | 'store' | 'b2b';

/** The key of `_meta` in a listed tool that holds its page kinds. */
export const TOOL_PAGE_KINDS_META_KEY = 'reactionary/pages';

const everywhere: readonly ToolPageKind[] = ['any'];
const shopping: readonly ToolPageKind[] = ['product', 'listing', 'cart'];
/** Where a customer sees a product by its SKU or key only: the cart, an order, the lists and the checkout. */
const productOfAnItem: readonly ToolPageKind[] = ['product', 'listing', 'cart', 'order', 'account', 'checkout'];
const shoppingAndLists: readonly ToolPageKind[] = ['product', 'listing', 'cart', 'account'];
const cartAndCheckout: readonly ToolPageKind[] = ['cart', 'checkout'];
const accountAndCheckout: readonly ToolPageKind[] = ['account', 'checkout'];
const lists: readonly ToolPageKind[] = ['account', 'product', 'listing'];
const company: readonly ToolPageKind[] = ['b2b', 'account'];

/**
 * The page kinds of every operation by `<capability name>.<method name>`. A tool is useful on more than the page it belongs
 * to: look up what a SKU in an order or a list is, or read the order after the checkout. List every kind where it is useful.
 * `any` is for the tools that are used from most pages, like adding to the cart and signing in. An operation that is not in
 * here is offered on every page.
 */
export const TOOL_PAGE_KINDS: Readonly<Record<string, readonly ToolPageKind[]>> = {
  'cart.getActiveCartId': everywhere,
  'cart.createCart': everywhere,
  'cart.getById': everywhere,
  'cart.add': everywhere,
  'cart.changeQuantity': cartAndCheckout,
  'cart.remove': cartAndCheckout,
  'cart.applyCouponCode': cartAndCheckout,
  'cart.removeCouponCode': cartAndCheckout,
  'cart.changeCurrency': cartAndCheckout,
  'cart.renameCart': cartAndCheckout,
  'cart.deleteCart': cartAndCheckout,
  'cart.listCarts': cartAndCheckout,

  'category.findTopCategories': everywhere,
  'category.findChildCategories': ['listing', 'product'],
  'category.getById': ['listing', 'product'],
  'category.getBySlug': ['listing', 'product'],
  'category.getBreadcrumbPathToCategory': ['listing', 'product'],

  'product.getById': productOfAnItem,
  'product.getBySlug': shopping,
  'product.getBySKU': productOfAnItem,

  'product-search.queryByTerm': everywhere,
  'product-search.createCategoryNavigationFilter': ['listing'],
  'product-search.resolveCategoryFromKey': ['listing'],

  'product-associations.getAccessories': ['product', 'cart'],
  'product-associations.getSpareparts': ['product', 'cart'],
  'product-associations.getReplacements': ['product', 'cart'],
  'product-recommendations.getRecommendations': shopping,
  'product-recommendations.getCollection': everywhere,

  'product-reviews.getRatingSummary': ['product', 'listing'],
  'product-reviews.findReviews': ['product'],
  'product-reviews.submitReview': ['product'],

  'price.getCustomerPrice': shoppingAndLists,
  'price.getListPrice': shoppingAndLists,
  'inventory.getBySKU': ['product', 'cart', 'checkout', 'account'],

  'store.list': ['store', 'product', 'checkout'],
  'store.getById': ['store', 'product', 'checkout'],
  'store.queryByProximity': ['store', 'product', 'checkout'],

  'checkout.initiateCheckoutForCart': cartAndCheckout,
  'checkout.getById': ['checkout', 'order'],
  'checkout.setShippingAddress': ['checkout'],
  'checkout.getAvailableShippingMethods': ['checkout'],
  'checkout.setShippingInstruction': ['checkout'],
  'checkout.getAvailablePaymentMethods': ['checkout'],
  'checkout.addPaymentInstruction': ['checkout'],
  'checkout.removePaymentInstruction': ['checkout'],
  'checkout.finalizeCheckout': ['checkout'],

  'order.getById': ['order', 'account'],
  'order-search.queryByTerm': ['order', 'account'],

  'identity.getSelf': everywhere,
  'identity.login': everywhere,
  'identity.logout': everywhere,
  'identity.register': accountAndCheckout,
  'identity.listProviders': everywhere,
  'identity.startExternalLogin': everywhere,
  'identity.completeExternalLogin': everywhere,

  'profile.getById': accountAndCheckout,
  'profile.update': ['account'],
  'profile.addShippingAddress': accountAndCheckout,
  'profile.updateShippingAddress': ['account'],
  'profile.removeShippingAddress': ['account'],
  'profile.makeShippingAddressDefault': ['account'],
  'profile.setBillingAddress': accountAndCheckout,
  'personalization-profile.getPersonalizationProfile': everywhere,

  'product-lists.queryLists': lists,
  'product-lists.getById': lists,
  'product-lists.queryListItems': lists,
  'product-lists.addItem': lists,
  'product-lists.addList': ['account'],
  'product-lists.updateList': ['account'],
  'product-lists.deleteList': ['account'],
  'product-lists.updateItem': ['account'],
  'product-lists.deleteItem': ['account'],

  'taxonomy.getVocabulary': ['listing', 'product'],
  'taxonomy.getConcepts': ['listing', 'product'],
  'taxonomy.getRelatedConcepts': ['listing'],
  'taxonomy.expandConcepts': ['listing'],
  'taxonomy.expandAffinities': ['listing'],
  'taxonomy.rankByConcepts': ['listing'],

  'company.getById': ['b2b', 'account', 'checkout'],
  'company.listCompanies': ['b2b', 'account', 'checkout'],
  'company.addShippingAddress': company,
  'company.updateShippingAddress': company,
  'company.removeShippingAddress': company,
  'company.makeShippingAddressDefault': company,
  'company-registration.requestRegistration': company,
  'company-registration.checkRequestStatus': company,
  'employees.listEmployees': ['b2b'],
  'employees.getByEmail': ['b2b'],
  'employees.assignRole': ['b2b'],
  'employees.unassignRole': ['b2b'],
  'employees.removeEmployee': ['b2b'],
  'employee-invitation.inviteEmployee': ['b2b'],
  'employee-invitation.listInvitations': ['b2b'],
  'employee-invitation.acceptInvitation': company,
  'employee-invitation.revokeInvitation': ['b2b'],
};
