import type { CartPaymentInstruction } from '../schemas/models/payment.model';
import type { CartPaymentMutationAddPayment, CartPaymentMutationCancelPayment } from '../schemas/mutations/cart-payment.mutation';
import type { CartPaymentQueryByCart } from '../schemas/queries/cart-payment.query';
import type { RequestContext} from '../schemas/session.schema';
import { Session } from '../schemas/session.schema';
import { BaseProvider } from './base.provider';

export abstract class CartPaymentProvider<
  T extends CartPaymentInstruction = CartPaymentInstruction
> extends BaseProvider<T> {



  /**
   * Returns all payment instructions associated with a given cart, optionally filtered by status
   *
   * Usecase: Fetch all registered payment instructions to show on checkout page, in case you support multiple payments in your storefront,
   * and need to show how far the user has come in the payment process. Also useful if user reloads page, or goes back to site or otherwise breaks the flow.
   *
   * Only returns payment instructions in status 'pending' or 'authorized'
   * @param cartIdentifier
   * @param session
   */
  public abstract getByCartIdentifier(payload: CartPaymentQueryByCart, reqCtx: RequestContext): Promise<T[]>;


  /**
   * Calls payment provider to set up a new payment intent. Returns whatever is needed to continue the payment process, e.g. a client secret for Stripe, or a redirect URL for PayPal.
   *
   * Usecase: User has filled out checkout form, and is ready to pay. You call this to get the payment process started.
   *
   * Note: The payment provider MAY change the cart during the payment process, so be sure to reload the cart object after this call.
   *
   * @param payload
   * @param session
   */
  public abstract initiatePaymentForCart(payload: CartPaymentMutationAddPayment, reqCtx: RequestContext): Promise<T>;



  /**
   * Cancel a payment instruction. This will typically void the payment intent in the payment provider, and set the status of the payment instruction to 'canceled'.
   *
   * Usecase: User has decided to cancel the payment, e.g. by going back in the checkout process, or by closing the browser window. You call this to clean up the payment instruction.
   *
   * Note: The payment provider MAY change the cart during the cancellation process, so be sure to reload the cart object after this call.
   *
   * @param payload
   * @param session
   * @returns
   */
  public abstract cancelPaymentInstruction(payload: CartPaymentMutationCancelPayment, reqCtx: RequestContext): Promise<T>;

  protected override getResourceName(): string {
    return 'cart-payment-instruction';
  }
}
