import type { NotFoundError } from "../schemas/index.js";
import type { Cart } from "../schemas/models/cart.model.js";
import type { CartIdentifier } from "../schemas/models/identifiers.model.js";
import type { CartMutationApplyCoupon, CartMutationChangeCurrency, CartMutationDeleteCart, CartMutationItemAdd, CartMutationItemQuantityChange, CartMutationItemRemove, CartMutationRemoveCoupon } from "../schemas/mutations/cart.mutation.js";
import type { CartQueryById } from "../schemas/queries/cart.query.js";
import type { Result } from "../schemas/result.js";
import { BaseProvider } from "./base.provider.js";

/**
 * @group Providers
 */
export abstract class CartProvider extends BaseProvider {

  /**
   * Get cart by ID.
   *
   * Usecase: Unclear, until we support multiple carts per user.
   * @param payload
   * @param session
   */
  public abstract getById(payload: CartQueryById): Promise<Result<Cart, NotFoundError>>;


  /**
   * Get the active cart id for the user.
   *
   * Usecase: Most common usecase during site load, or after login. You want to get the active cart for the user, so you can display it in the minicart.
   * @param session
   */
  public abstract getActiveCartId(): Promise<Result<CartIdentifier, NotFoundError>>;


  /**
   * Add item to cart. If no cart exists, create a new one. Returns the updated and recalculated cart.
   * Does not automatically consolidate items, so if you want to have second add of same item to increase quantity,
   * you need to handle that in your logic or on the server.
   *
   * Usecase: Add item to cart, create cart if none exists.
   * @param payload
   * @param session
   */
  public abstract add(payload: CartMutationItemAdd): Promise<Result<Cart>>;

  /**
   * Remove item from cart. If the cart is empty after removal, delete the cart. Returns the updated and recalculated cart.
   *
   * Usecase: Remove item from cart, delete cart if empty.
   * @param payload
   * @param session
   */
  public abstract remove(payload: CartMutationItemRemove): Promise<Result<Cart>>;

  /**
   * Change quantity of item in cart. If the cart is empty after change, delete the cart. Returns the updated and recalculated cart.
   * Changing quantity to 0 is not allowed. Use the remove call instead. This is done to avoid accidental removal of item.
   * Calls with quantity 0 will just be ignored.
   *
   * Usecase: Change quantity of item in cart,  like in a minicart, or in the full cart view.
   * @param payload
   * @param session
   */
  public abstract changeQuantity(payload: CartMutationItemQuantityChange): Promise<Result<Cart>>;


  /**
   * Deletes the entire cart.
   *
   * Usecase: User wants to empty the cart or something is wrong with the current cart, and you want to clear it out and start fresh.
   * @param payload
   * @param session
   */
  public abstract deleteCart(payload: CartMutationDeleteCart): Promise<Result<void>>;

  /**
   * Applies a coupon code to the cart. Returns the updated and recalculated cart.
   *
   * Usecase: User applies a coupon code during checkout.
   * @param payload
   * @param session
   */
  public abstract applyCouponCode(payload: CartMutationApplyCoupon): Promise<Result<Cart>>;


  /**
   * Removes a coupon code from the cart. Returns the updated and recalculated cart.
   *
   * Usecase: User removes a coupon code during checkout.
   * @param payload
   * @param session
   */
  public abstract removeCouponCode(payload: CartMutationRemoveCoupon): Promise<Result<Cart>>;

  /**
   * Changes the currency of the cart.
   *
   * Usecase: User wants to change the currency for his session. This will change the currency of the cart, and recalculate prices.
   * @param newCurrency
   * @param session
   */
  public abstract changeCurrency(payload: CartMutationChangeCurrency): Promise<Result<Cart>>;

  protected override getResourceName(): string {
    return 'cart';
  }
}

