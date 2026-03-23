import type { NotFoundError } from "../schemas/index.js";
import type { Cart, CartPaginatedSearchResult } from "../schemas/models/cart.model.js";
import type { CartIdentifier } from "../schemas/models/identifiers.model.js";
import type { CartMutationApplyCoupon, CartMutationChangeCurrency, CartMutationCreateCart, CartMutationDeleteCart, CartMutationItemAdd, CartMutationItemQuantityChange, CartMutationItemRemove, CartMutationRemoveCoupon, CartMutationRenameCart } from "../schemas/mutations/cart.mutation.js";
import type { CartQueryById, CartQueryList } from "../schemas/queries/cart.query.js";
import type { Result } from "../schemas/result.js";
import { BaseCapability } from "./base.capability.js";

/**
 * @group Providers
 */
export abstract class CartCapability<
  TCart extends Cart = Cart,
  TCartIdentifier extends CartIdentifier = CartIdentifier,
> extends BaseCapability {

  /**
   * Get cart by ID.
   *
   * Usecase: Unclear, until we support multiple carts per user.
   * @param payload
   * @param session
   */
  public abstract getById(payload: CartQueryById): Promise<Result<TCart, NotFoundError>>;


  /**
   * Get the active cart id for the user.
   *
   * Usecase: Most common usecase during site load, or after login. You want to get the active cart for the user, so you can display it in the minicart.
   * @param session
   *
   * @deprecated This method is deprecated, because it assumes that there is only one active cart per user. This might not be the case in the future, when we support multiple carts per user. Use the listCarts method instead, and get the active cart from the list.
   */
  public abstract getActiveCartId(): Promise<Result<TCartIdentifier, NotFoundError>>;


  /**
   * Add item to cart. If no cart exists, create a new one. Returns the updated and recalculated cart.
   * Does not automatically consolidate items, so if you want to have second add of same item to increase quantity,
   * you need to handle that in your logic or on the server.
   *
   * Usecase: Add item to cart, create cart if none exists.
   * @param payload
   * @param session
   */
  public abstract add(payload: CartMutationItemAdd): Promise<Result<TCart>>;

  /**
   * Remove item from cart. If the cart is empty after removal, delete the cart. Returns the updated and recalculated cart.
   *
   * Usecase: Remove item from cart, delete cart if empty.
   * @param payload
   * @param session
   */
  public abstract remove(payload: CartMutationItemRemove): Promise<Result<TCart>>;

  /**
   * Change quantity of item in cart. If the cart is empty after change, delete the cart. Returns the updated and recalculated cart.
   * Changing quantity to 0 is not allowed. Use the remove call instead. This is done to avoid accidental removal of item.
   * Calls with quantity 0 will just be ignored.
   *
   * Usecase: Change quantity of item in cart,  like in a minicart, or in the full cart view.
   * @param payload
   * @param session
   */
  public abstract changeQuantity(payload: CartMutationItemQuantityChange): Promise<Result<TCart>>;


  /**
   * Usecase:
   * Get all carts for the user. This is needed if you want to support multiple carts per user, and show a cart switcher in the UI, or something like that. If you only support one cart per user, this can just return the active cart.
   *
   * @param payload
   */
  public abstract listCarts(payload : CartQueryList): Promise<Result<CartPaginatedSearchResult>>;

  /**
   * Usecase:
   * User is adding something to cart, but no cart exists yet. You want to create a new cart and add the item to it in one step, instead of having to call createCart first, and then add.
   *
   * Usecase:
   * You might want to create a new cart, so you have mulitple carts open
   * @param payload
   */
  public abstract createCart(payload: CartMutationCreateCart): Promise<Result<TCart>>;


  /**
   * Deletes the entire cart.
   *
   * Usecase: User wants to empty the cart or something is wrong with the current cart, and you want to clear it out and start fresh.
   * @param payload
   * @param session
   */
  public abstract deleteCart(payload: CartMutationDeleteCart): Promise<Result<void>>;


  /**
   * Usecase:
   * User wants to rename the cart after creation, to make it easier to identify in a list of multiple carts.
   */
  public abstract renameCart(payload: CartMutationRenameCart): Promise<Result<TCart>>;



  /**
   * Applies a coupon code to the cart. Returns the updated and recalculated cart.
   *
   * Usecase: User applies a coupon code during checkout.
   * @param payload
   * @param session
   */
  public abstract applyCouponCode(payload: CartMutationApplyCoupon): Promise<Result<TCart>>;


  /**
   * Removes a coupon code from the cart. Returns the updated and recalculated cart.
   *
   * Usecase: User removes a coupon code during checkout.
   * @param payload
   * @param session
   */
  public abstract removeCouponCode(payload: CartMutationRemoveCoupon): Promise<Result<TCart>>;

  /**
   * Changes the currency of the cart.
   *
   * Usecase: User wants to change the currency for his session. This will change the currency of the cart, and recalculate prices.
   * @param newCurrency
   * @param session
   */
  public abstract changeCurrency(payload: CartMutationChangeCurrency): Promise<Result<TCart>>;

  protected override getResourceName(): string {
    return 'cart';
  }
}
