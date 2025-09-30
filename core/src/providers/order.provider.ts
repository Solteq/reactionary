import { BaseProvider } from "./base.provider";
import type { RequestContext } from "../schemas/session.schema";
import type { Order } from "../schemas/models";
import type { OrderQueryById } from "../schemas/queries";

export abstract class OrderProvider<
  T extends Order = Order
> extends BaseProvider<T> {

  /**
   * Get order by ID.
   *
   * Usecase: Fetch order after checkout, to check if we are fully paid and can continue to order confirmation page.
   * @param payload
   * @param session
   */
  public abstract getById(payload: OrderQueryById, reqCtx: RequestContext): Promise<T>;

  protected createEmptyOrder(): T {
    const order = this.newModel();
    order.meta = { placeholder: true, cache: { hit: true, key: 'empty-order' } };
    order.identifier = { key: '' };
    return order;
  }

  protected override getResourceName(): string {
    return 'order';
  }
}


