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

const any: readonly ToolPageKind[] = ['any'];
const shopping: readonly ToolPageKind[] = ['product', 'listing', 'cart'];
const cartAndCheckout: readonly ToolPageKind[] = ['cart', 'checkout'];
const accountAndCheckout: readonly ToolPageKind[] = ['account', 'checkout'];
const lists: readonly ToolPageKind[] = ['account', 'product', 'listing'];
const company: readonly ToolPageKind[] = ['b2b', 'account'];

/**
 * The page kinds of every operation by `<capability name>.<method name>`. A tool is useful on more than the page it belongs
 * to, adding to the cart is done from a product page and a listing, so list every kind where it is. An operation that is not
 * in here is offered on every page.
 */
export const TOOL_PAGE_KINDS: Readonly<Record<string, readonly ToolPageKind[]>> = {
  'cart.getActiveCartId': any,
  'cart.createCart': any,
  'cart.getById': any,
  'cart.add': any,
  'cart.changeQuantity': cartAndCheckout,
  'cart.remove': cartAndCheckout,
  'cart.applyCouponCode': cartAndCheckout,
  'cart.removeCouponCode': cartAndCheckout,
  'cart.changeCurrency': cartAndCheckout,
  'cart.renameCart': cartAndCheckout,
  'cart.deleteCart': cartAndCheckout,
  'cart.listCarts': cartAndCheckout,

  'category.findTopCategories': any,
  'category.findChildCategories': ['listing', 'product'],
  'category.getById': ['listing', 'product'],
  'category.getBySlug': ['listing', 'product'],
  'category.getBreadcrumbPathToCategory': ['listing', 'product'],

  'product.getById': shopping,
  'product.getBySlug': shopping,
  'product.getBySKU': shopping,

  'product-search.queryByTerm': any,
  'product-search.createCategoryNavigationFilter': ['listing'],
  'product-search.resolveCategoryFromKey': ['listing'],

  'product-associations.getAccessories': ['product', 'cart'],
  'product-associations.getSpareparts': ['product', 'cart'],
  'product-associations.getReplacements': ['product', 'cart'],
  'product-recommendations.getRecommendations': shopping,
  'product-recommendations.getCollection': any,

  'product-reviews.getRatingSummary': ['product', 'listing'],
  'product-reviews.findReviews': ['product'],
  'product-reviews.submitReview': ['product'],

  'price.getCustomerPrice': shopping,
  'price.getListPrice': shopping,
  'inventory.getBySKU': ['product', 'cart', 'checkout'],

  'store.list': ['store', 'product', 'checkout'],
  'store.getById': ['store', 'product', 'checkout'],
  'store.queryByProximity': ['store', 'product', 'checkout'],

  'checkout.initiateCheckoutForCart': cartAndCheckout,
  'checkout.getById': ['checkout'],
  'checkout.setShippingAddress': ['checkout'],
  'checkout.getAvailableShippingMethods': ['checkout'],
  'checkout.setShippingInstruction': ['checkout'],
  'checkout.getAvailablePaymentMethods': ['checkout'],
  'checkout.addPaymentInstruction': ['checkout'],
  'checkout.removePaymentInstruction': ['checkout'],
  'checkout.finalizeCheckout': ['checkout'],

  'order.getById': ['order', 'account'],
  'order-search.queryByTerm': ['order', 'account'],

  'identity.getSelf': any,
  'identity.login': any,
  'identity.logout': any,
  'identity.register': accountAndCheckout,
  'identity.listProviders': any,
  'identity.startExternalLogin': any,
  'identity.completeExternalLogin': any,

  'profile.getById': accountAndCheckout,
  'profile.update': ['account'],
  'profile.addShippingAddress': accountAndCheckout,
  'profile.updateShippingAddress': ['account'],
  'profile.removeShippingAddress': ['account'],
  'profile.makeShippingAddressDefault': ['account'],
  'profile.setBillingAddress': accountAndCheckout,
  'personalization-profile.getPersonalizationProfile': any,

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
  'employee-invitation.acceptInvitation': ['b2b'],
  'employee-invitation.revokeInvitation': ['b2b'],
};
