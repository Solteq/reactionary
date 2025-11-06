import { BaseProvider } from "./base.provider.js";
import type { RequestContext } from "../schemas/session.schema.js";
import type { Order } from "../schemas/models/index.js";
import type { OrderQueryById } from "../schemas/queries/index.js";

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
  public abstract getById(payload: OrderQueryById): Promise<T>;

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


