import type { Checkout, PaymentMethod, ShippingMethod } from "../schemas/models";
import type { RequestContext } from "../schemas/session.schema";
import { BaseProvider } from "./base.provider";
import type { CheckoutMutationFinalizeCheckout, CheckoutMutationInitiateCheckout, CheckoutMutationSetShippingAddress,  CheckoutMutationAddPaymentInstruction, CheckoutMutationRemovePaymentInstruction, CheckoutMutationSetShippingInstruction } from "../schemas/mutations/checkout.mutation";
import type { CheckoutQueryById, CheckoutQueryForAvailablePaymentMethods, CheckoutQueryForAvailableShippingMethods } from "../schemas/queries";

export abstract class CheckoutProvider<
  T extends Checkout = Checkout
> extends BaseProvider<T> {

  /**
   * This starts a new checkout session for the given cart. The checkout might duplicate the cart, or just reference it, depending on implementation, but changes to the cart,
   * is not reflected in the checkout, and vice versa. The checkout is a snapshot of the cart at the time of initiation.
   * The checkout will typically copy over addresses from the user profile, if available, or from the anonymous profile in the session.
   *
   * Usecase: User has filled out cart, and is ready to checkout. You call this to create a checkout object, that you can then use to set shipping method, payment method etc.
   * @param cartId The cart you are trying to checkout
   * @param billingAddress the billing/shipping address to start with. This affects available shipping methods, and may be required by some payment providers.
   * @param reqCtx
   */
  public abstract initiateCheckoutForCart(payload: CheckoutMutationInitiateCheckout, reqCtx: RequestContext): Promise<T>;


  /**
   * Fetches an existing checkout by its identifier.
   *
   * Usecase: User has navigated to the checkout page, or reloaded on it , or has been redirected back from the payment provider.
   * @param payload
   * @param reqCtx
   */
  public abstract getById(payload:  CheckoutQueryById, reqCtx: RequestContext): Promise<T | null>;



  /**
   * Updates the shipping address for the checkout and recalculates the shipping methods and totals.
   *
   * Usecase: User has chosen home delivery and you have allowed them to change the address on the checkout page.
   *
   * NOTE: Unsure this is really needed.
   * @param shippingAddress The updated shipping address. Note: This may also be the billing address, if your store does not differentiate.
   */
  public abstract setShippingAddress(payload: CheckoutMutationSetShippingAddress, reqCtx: RequestContext): Promise<T>;

  /**
   * Returns all available shipping methods for the given checkout. This will typically depend on the shipping address, and possibly also the items in the checkout.
   *
   * Usecase: User has filled out shipping address, and you need to show available shipping methods.
   *
   * @param checkoutId The checkout you want to get shipping methods for.
   * @param reqCtx
   */
  public abstract getAvailableShippingMethods(payload: CheckoutQueryForAvailableShippingMethods, reqCtx: RequestContext): Promise<ShippingMethod[]>;

  /**
   * Returns all available payment methods for the given checkout. This will typically depend mostly on the billing address and jurisdiction.
   *
   * Usecase: User has chosen shipping method, and you need to show available payment methods.
   *
   * @param checkoutId The checkout you want to get payment methods for.
   * @param reqCtx
   */
  public abstract getAvailablePaymentMethods(payload: CheckoutQueryForAvailablePaymentMethods, reqCtx: RequestContext): Promise<PaymentMethod[]>;


  /**
   * Adds a payment instruction to the checkout. This will typically create a payment intent in the payment provider, and return whatever is needed to continue the payment process, e.g. a client secret for Stripe, or a redirect URL for PayPal.
   *
   * Usecase: User has chosen a payment method, and you need to start the payment process.
   */
  public abstract addPaymentInstruction(payload: CheckoutMutationAddPaymentInstruction, reqCtx: RequestContext): Promise<T>;

  /**
   * Removes a payment instruction from the checkout. This will typically void the payment intent in the payment provider, and remove the payment instruction from the checkout.
   *
   * Usecase: User has decided to change payment method, or has cancelled the payment process.
   * @param paymentInstructionId
   */
  public abstract removePaymentInstruction(payload: CheckoutMutationRemovePaymentInstruction, reqCtx: RequestContext): Promise<T>;



  /**
   * Sets the shipping method and optional pickup point for the checkout. The pickup point can be a physical store, a locker, or similar.
   * If it is unset, it means home delivery to the shipping address.
   *
   *
   * Usecase: record all the users shipping choices, and any special instructions they may have added.
   *
   * @param shippingMethodId
   * @param pickupPoint
   */
  public abstract setShippingInstruction(payload: CheckoutMutationSetShippingInstruction, reqCtx: RequestContext): Promise<T>;

  /**
   * Finalizes the checkout process. This typically involves creating an order from the checkout and processing payment.
   *
   * Usecase: User has completed all necessary steps in the checkout process and is ready to place the order.
   *
   * @param payload
   * @param reqCtx
   */
  public abstract finalizeCheckout(payload: CheckoutMutationFinalizeCheckout, reqCtx: RequestContext): Promise<T>;
}



  /**
   *
   *
   * How would this be used?
   * // navigated to /payment
   *
   * const cart = await cartProvider.getById({id: 'cart-123'}, reqCtx);
   *
   * let address = null;
   * if (reqCtx.identity.isAuthenticated) {
   *  const profile = await profileProvider.getByUserId({userId: reqCtx.identity.userId}, reqCtx);
   *   address = profile?.addresses?.[0];
   * }
   * if (!address) {
   *    address = reqCtx.session.anonymousProfile?.addresses?.[0];
   * }
   *
   * // ok we are ready for checkout...
   * const checkout = await checkoutProvider.initiateCheckoutForCart(cart.identifier, address, reqCtx);
   *
   * const paymentMethods = await paymentProvider.getAvailablePaymentMethods(checkout, reqCtx);
   * const shippingMethods = await shippingProvider.getAvailableShippingMethods(checkout, reqCtx);
   *
   *
   * onShippingSelected = async (shippingMethodId, pickupPoint) => {
   *   const checkout = await checkoutProvider.setShippingMethod(checkout.identifier, shippingMethodId, pickupPoint);
   *   return checkout;
   * }
   *
   * onPaymentSelected = async (paymentMethodId) => {
   *   const checkout = await checkoutProvider.addPaymentInstruction(checkout.identifier, paymentMethodId);
   *   return checkout;
   * }
   *
   * if (checkout.paymentInstructions.length === 0) {
   *    // show payment method selection
   *     return <PaymentMethodSelection methods={paymentMethods} onSelect={onPaymentSelected} />
   *
   * } else {
   * if (checkout.paymentInstructions[0].status !== 'Authorized') {
   *    const pi = checkout.paymentInstructions[0];
   *    if (pi.provider === 'stripe') {
   *         return new StripeForm(pi.protocolData.find(x => x.key === 'clientSecret').value, onPaymentAuthorized);
   *    } else if (pi.provider === 'adyen') {
   *         return new RedirectTo(pi.protocolData.find(x => x.key === 'punchoutUrl').value);
   *    }
   *   }
   * })
   */
