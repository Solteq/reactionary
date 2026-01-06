import type { OrderSearchResult } from "../schemas/models/order-search.model.js";
import type { OrderSearchQueryByTerm } from "../schemas/queries/order-search.query.js";
import type { Result } from "../schemas/result.js";
import { BaseProvider } from "./base.provider.js";

/**
 * This provider handles order search operations. In some situations you may have different providers for order history listing and detail retrieval.
 * The order search is primarily focused on searching and listing orders based on various criteria, and returns only summary information about each order.
 *
 * Usecase: An e-commerce platform wants to provide customers with a way to search through their past orders using filters like date range, order status, or total amount spent.
 */
export abstract class OrderSearchProvider extends BaseProvider {
  protected override getResourceName(): string {
    return 'order-search';
  }

  /**
   * Queries orders based on the provided search criteria.
   *
   * Usecase: A customer is in the My Account section, and wants to search for orders placed within the last month that are marked as "shipped".
   * Usecase: A widget on the frontpage after login, shows the last 5 orders placed by the customer.
   * @param payload The search criteria for querying orders.
   */
  public abstract queryByTerm(payload: OrderSearchQueryByTerm): Promise<Result<OrderSearchResult>>;




}
