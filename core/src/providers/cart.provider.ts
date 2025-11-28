import type { Cart } from "../schemas/models/cart.model.js";
import type { CartIdentifier } from "../schemas/models/identifiers.model.js";
import type { CartMutationApplyCoupon, CartMutationChangeCurrency, CartMutationDeleteCart, CartMutationItemAdd, CartMutationItemQuantityChange, CartMutationItemRemove, CartMutationRemoveCoupon } from "../schemas/mutations/cart.mutation.js";
import type { CartQueryById } from "../schemas/queries/cart.query.js";
import { BaseProvider } from "./base.provider.js";

export abstract class CartProvider extends BaseProvider {

  /**
   * Get cart by ID.
   *
   * Usecase: Unclear, until we support multiple carts per user.
   * @param payload
   * @param session
   */
  public abstract getById(payload: CartQueryById): Promise<Cart>;


  /**
   * Get the active cart id for the user.
   *
   * Usecase: Most common usecase during site load, or after login. You want to get the active cart for the user, so you can display it in the minicart.
   * @param session
   */
  public abstract getActiveCartId(): Promise<CartIdentifier>;


  /**
   * Add item to cart. If no cart exists, create a new one. Returns the updated and recalculated cart.
   * Does not automatically consolidate items, so if you want to have second add of same item to increase quantity,
   * you need to handle that in your logic or on the server.
   *
   * Usecase: Add item to cart, create cart if none exists.
   * @param payload
   * @param session
   */
  public abstract add(payload: CartMutationItemAdd): Promise<Cart>;

  /**
   * Remove item from cart. If the cart is empty after removal, delete the cart. Returns the updated and recalculated cart.
   *
   * Usecase: Remove item from cart, delete cart if empty.
   * @param payload
   * @param session
   */
  public abstract remove(payload: CartMutationItemRemove): Promise<Cart>;

  /**
   * Change quantity of item in cart. If the cart is empty after change, delete the cart. Returns the updated and recalculated cart.
   * Changing quantity to 0 is not allowed. Use the remove call instead. This is done to avoid accidental removal of item.
   * Calls with quantity 0 will just be ignored.
   *
   * Usecase: Change quantity of item in cart,  like in a minicart, or in the full cart view.
   * @param payload
   * @param session
   */
  public abstract changeQuantity(payload: CartMutationItemQuantityChange): Promise<Cart>;


  /**
   * Deletes the entire cart.
   *
   * Usecase: User wants to empty the cart or something is wrong with the current cart, and you want to clear it out and start fresh.
   * @param payload
   * @param session
   */
  public abstract deleteCart(payload: CartMutationDeleteCart): Promise<Cart>;

  /**
   * Applies a coupon code to the cart. Returns the updated and recalculated cart.
   *
   * Usecase: User applies a coupon code during checkout.
   * @param payload
   * @param session
   */
  public abstract applyCouponCode(payload: CartMutationApplyCoupon): Promise<Cart>;


  /**
   * Removes a coupon code from the cart. Returns the updated and recalculated cart.
   *
   * Usecase: User removes a coupon code during checkout.
   * @param payload
   * @param session
   */
  public abstract removeCouponCode(payload: CartMutationRemoveCoupon): Promise<Cart>;

  /**
   * Changes the currency of the cart.
   *
   * Usecase: User wants to change the currency for his session. This will change the currency of the cart, and recalculate prices.
   * @param newCurrency
   * @param session
   */
  public abstract changeCurrency(payload: CartMutationChangeCurrency): Promise<Cart>;

  protected createEmptyCart(): Cart {
    const cart = {
      identifier: { key: '' },
      meta: { placeholder: true, cache: { hit: true, key: 'empty-cart' } },
      description: '',
      items: [],
      name: '',
      price: {
        grandTotal: {
          value: 0,
          currency: 'XXX'
        },
        totalDiscount: {
          value: 0,
          currency: 'XXX'
        },
        totalProductPrice: {
          value: 0,
          currency: 'XXX'
        },
        totalShipping: {
          value: 0,
          currency: 'XXX'
        },
        totalSurcharge: {
          value: 0,
          currency: 'XXX'
        },
        totalTax: {
          value: 0,
          currency: 'XXX'
        }
      },
      userId: {
        userId: ''
      }
    } satisfies Cart;

    return cart;
  }

  protected override getResourceName(): string {
    return 'cart';
  }
}

