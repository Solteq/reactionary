import type { OrderPaymentInstruction } from '../schemas/models/payment.model';
import type { OrderPaymentQueryByOrder } from '../schemas/queries';
import type { RequestContext } from '../schemas/session.schema';
import { BaseProvider } from './base.provider';

export abstract class OrderPaymentProvider<
  T extends OrderPaymentInstruction = OrderPaymentInstruction
> extends BaseProvider<T> {

  /**
   * Returns all payment instructions associated with a given order, optionally filtered by status
   *
   * Usecase: After checkout poll this to see if all payment instructions are in 'authorized' status, and you can proceed to confirm the order.
   * Also useful if user reloads page, or goes back to site or otherwise breaks the flow.
   *
   *
   * @param orderIdentifier
   * @param session
   */
  public abstract getByOrderIdentifier(payload: OrderPaymentQueryByOrder, reqCtx: RequestContext): Promise<T[]>;

  protected override getResourceName(): string {
    return 'order-payments';
  }


}
