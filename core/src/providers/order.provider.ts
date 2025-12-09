import { BaseProvider } from './base.provider.js';
import type { Order } from '../schemas/models/index.js';
import type { OrderQueryById } from '../schemas/queries/index.js';
import type { Result } from '../schemas/result.js';
import type { NotFoundError } from '../schemas/index.js';

export abstract class OrderProvider extends BaseProvider {
  /**
   * Get order by ID.
   *
   * Usecase: Fetch order after checkout, to check if we are fully paid and can continue to order confirmation page.
   * @param payload
   * @param session
   */
  public abstract getById(payload: OrderQueryById): Promise<Result<Order, NotFoundError>>;

  protected createEmptyOrder(): Order {
    const order = {
      identifier: {
        key: '',
      },
      inventoryStatus: 'NotAllocated',
      items: [],
      orderStatus: 'AwaitingPayment',
      paymentInstructions: [],
      price: {
        grandTotal: {
          value: 0,
          currency: 'XXX',
        },
        totalDiscount: {
          value: 0,
          currency: 'XXX',
        },
        totalProductPrice: {
          value: 0,
          currency: 'XXX',
        },
        totalShipping: {
          value: 0,
          currency: 'XXX',
        },
        totalSurcharge: {
          value: 0,
          currency: 'XXX',
        },
        totalTax: {
          value: 0,
          currency: 'XXX',
        },
      },
      userId: {
        userId: '',
      },
    } satisfies Order;

    return order;
  }

  protected override getResourceName(): string {
    return 'order';
  }
}
