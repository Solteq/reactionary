import {
  CartCapability,
  CartIdentifierSchema,
  CartMutationApplyCouponSchema,
  CartMutationChangeCurrencySchema,
  CartMutationCreateCartSchema,
  CartMutationDeleteCartSchema,
  CartMutationItemAddSchema,
  CartMutationItemQuantityChangeSchema,
  CartMutationItemRemoveSchema,
  CartMutationRemoveCouponSchema,
  CartMutationRenameCartSchema,
  CartPaginatedSearchResultSchema,
  CartQueryByIdSchema,
  CartQueryListSchema,
  CartSchema,
  Reactionary,
  error,
  success,
  type Cache,
  type CartFactory,
  type CartFactoryCartOutput,
  type CartFactoryIdentifierOutput,
  type CartFactoryWithOutput,
  type CartMutationApplyCoupon,
  type CartMutationChangeCurrency,
  type CartMutationCreateCart,
  type CartMutationDeleteCart,
  type CartMutationItemAdd,
  type CartMutationItemQuantityChange,
  type CartMutationItemRemove,
  type CartMutationRemoveCoupon,
  type CartMutationRenameCart,
  type CartQueryById,
  type CartQueryList,
  type NotFoundError,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import createDebug from 'debug';
import { HclCartNotFoundError, type HclClient } from '../core/client.js';
import type { HclCartFactory } from '../factories/cart/cart.factory.js';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type {
  HclWcsCartResponse,
  HclWcsCreateOrderResponse,
  HclWcsOrderItemUpdateResponse,
  HclWcsOrderListResponse,
} from '../schema/hcl.schema.js';

const debug = createDebug('reactionary:hcl:cart');

export class HclCartCapability<
  TFactory extends CartFactory = HclCartFactory,
> extends CartCapability<
  CartFactoryCartOutput<TFactory>,
  CartFactoryIdentifierOutput<TFactory>
> {
  protected config: HclConfiguration;
  protected client: HclClient;
  protected factory: CartFactoryWithOutput<TFactory>;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: HclConfiguration,
    client: HclClient,
    factory: CartFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.client = client;
    this.factory = factory;
  }

  protected setPendingOrderUrl(orderId: string): string {
    return `${this.client.transactionBaseUrl}/cart/${encodeURIComponent(orderId)}/set_pending_order`;
  }

  protected setPendingOrderPayload(orderId: string): { orderId: string } {
    return { orderId };
  }

  /**
   * Set the specified order as the current pending (@self) order.
   * After this call, @self endpoints will operate on that orderId.
   */
  protected async fetchSetPendingOrder(orderId: string): Promise<void> {
    await this.client.callPost<unknown>(
      this.setPendingOrderUrl(orderId),
      this.setPendingOrderPayload(orderId),
    );
  }

  protected wcsOrderUrl(orderId: string): string {
    return `${this.client.transactionBaseUrl}/order/${encodeURIComponent(orderId)}`;
  }

  /**
   * Fetch a specific order by ID directly from the Order API.
   * Does NOT call set_pending_order — safe to use for read-only access.
   * Throws HclCartNotFoundError on 404.
   */
  protected async fetchWcsOrder(orderId: string): Promise<HclWcsCartResponse> {
    const data = await this.client.callGet<HclWcsCartResponse>(
      this.wcsOrderUrl(orderId),
      undefined,
      { allowUndefined: true },
    );
    if (!data) throw new HclCartNotFoundError();
    return data;
  }

  protected cartUrl(): string {
    return `${this.client.transactionBaseUrl}/cart/@self`;
  }

  /**
   * Fetch the raw WCS cart response.
   * If orderId is provided, uses GET /order/{orderId} directly (no side effects).
   * Without orderId, falls back to GET /cart/@self (current pending order).
   * Throws HclCartNotFoundError on 404.
   */
  protected async fetchWcsCart(orderId?: string): Promise<HclWcsCartResponse> {
    if (orderId) {
      return this.fetchWcsOrder(orderId);
    }
    const data = await this.client.callGet<HclWcsCartResponse>(
      this.cartUrl(),
      undefined,
      { allowUndefined: true },
    );
    if (!data) throw new HclCartNotFoundError();
    return data;
  }

  /** Fetch and parse the current cart via the factory. */
  protected async fetchCart(
    orderId?: string,
  ): Promise<CartFactoryCartOutput<TFactory>> {
    const data = await this.fetchWcsCart(orderId);
    return this.factory.parseCart(this.context, data);
  }

  protected addOrderItemUrl(currency?: string): string {
    const qs = currency ? `?currency=${encodeURIComponent(currency)}` : '';
    return `${this.client.transactionBaseUrl}/cart${qs}`;
  }

  protected addOrderItemPayload(partNumber: string, quantity: number): object {
    return {
      orderItem: [{ partNumber, quantity: String(quantity) }],
      x_calculateOrder: '1',
      x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
    };
  }

  protected updateOrderItemUrl(): string {
    return `${this.client.transactionBaseUrl}/cart/@self/update_order_item`;
  }

  protected updateOrderItemPayload(
    orderItemId: string,
    quantity: number,
  ): object {
    return {
      orderItem: [{ orderItemId, quantity: String(quantity) }],
      x_calculateOrder: '1',
      x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
    };
  }

  protected deleteOrderItemUrl(): string {
    return `${this.client.transactionBaseUrl}/cart/@self/delete_order_item`;
  }

  protected deleteOrderItemPayload(orderItemId: string): object {
    return {
      orderItemId,
      x_calculateOrder: '1',
      x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
    };
  }

  protected deleteCartUrl(orderId?: string): string {
    return orderId
      ? `${this.client.transactionBaseUrl}/cart/${encodeURIComponent(orderId)}/cancel_order`
      : `${this.client.transactionBaseUrl}/cart/@self`;
  }

  protected orderListUrl(): string {
    return `${this.client.transactionBaseUrl}/order/byStatus/P`;
  }

  protected createOrderUrl(): string {
    return `${this.client.transactionBaseUrl}/cart/create_order`;
  }

  protected createOrderParams(
    description?: string,
    currency?: string,
  ): URLSearchParams {
    const params = new URLSearchParams();
    // description is mandatory for WCS create_order — default to empty string.
    params.set('description', description ?? '');
    if (currency) params.set('currency', currency);
    return params;
  }

  protected updateOrderDescriptionUrl(): string {
    return `${this.client.transactionBaseUrl}/cart/@self/update_order_item`;
  }

  protected updateOrderDescriptionPayload(
    description: string,
    orderItem: Array<{ orderItemId: string; quantity: string }>,
  ): object {
    return {
      orderDescription: description,
      orderItem,
      x_calculateOrder: '1',
      x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
    };
  }

  protected addPromotionCodeUrl(): string {
    return `${this.client.transactionBaseUrl}/cart/@self/assigned_promotion_code`;
  }

  protected addPromotionCodePayload(code: string): { promoCode: string } {
    return { promoCode: code };
  }

  protected removePromotionCodeUrl(code: string): string {
    return `${this.client.transactionBaseUrl}/cart/@self/assigned_promotion_code/${encodeURIComponent(code)}`;
  }

  @Reactionary({
    inputSchema: CartQueryByIdSchema,
    outputSchema: CartSchema,
  })
  public override async getById(
    payload: CartQueryById,
  ): Promise<Result<CartFactoryCartOutput<TFactory>, NotFoundError>> {
    debug('getById %s', payload.cart.key);
    try {
      const cart = await this.fetchCart(payload.cart.key || undefined);
      return success(cart);
    } catch (err) {
      if (err instanceof HclCartNotFoundError) {
        return error<NotFoundError>({ type: 'NotFound', identifier: '' });
      }
      throw err;
    }
  }

  @Reactionary({
    outputSchema: CartIdentifierSchema,
  })
  public override async getActiveCartId(): Promise<
    Result<CartFactoryIdentifierOutput<TFactory>, NotFoundError>
  > {
    debug('getActiveCartId');
    try {
      const data = await this.fetchWcsCart();
      return success(this.factory.parseCartIdentifier(this.context, data));
    } catch (err) {
      if (err instanceof HclCartNotFoundError) {
        return error<NotFoundError>({ type: 'NotFound', identifier: '' });
      }
      throw err;
    }
  }

  @Reactionary({
    inputSchema: CartMutationItemAddSchema,
    outputSchema: CartSchema,
  })
  public override async add(
    payload: CartMutationItemAdd,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug(
      'add %s x%d cart=%s',
      payload.variant.sku,
      payload.quantity,
      payload.cart.key,
    );
    if (payload.cart.key) {
      await this.fetchSetPendingOrder(payload.cart.key);
    }
    await this.client.callPost<HclWcsOrderItemUpdateResponse>(
      this.addOrderItemUrl(),
      this.addOrderItemPayload(payload.variant.sku, payload.quantity),
    );
    return success(await this.fetchCart(payload.cart.key || undefined));
  }

  @Reactionary({
    inputSchema: CartMutationItemRemoveSchema,
    outputSchema: CartSchema,
  })
  public override async remove(
    payload: CartMutationItemRemove,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug('remove orderItemId=%s cart=%s', payload.item.key, payload.cart.key);
    if (payload.cart.key) {
      await this.fetchSetPendingOrder(payload.cart.key);
    }
    await this.client.callPut<void>(
      this.deleteOrderItemUrl(),
      this.deleteOrderItemPayload(payload.item.key),
    );
    return success(await this.fetchCart(payload.cart.key || undefined));
  }

  @Reactionary({
    inputSchema: CartMutationItemQuantityChangeSchema,
    outputSchema: CartSchema,
  })
  public override async changeQuantity(
    payload: CartMutationItemQuantityChange,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug(
      'changeQuantity orderItemId=%s qty=%d cart=%s',
      payload.item.key,
      payload.quantity,
      payload.cart.key,
    );
    if (payload.cart.key) {
      await this.fetchSetPendingOrder(payload.cart.key);
    }
    await this.client.callPut<HclWcsOrderItemUpdateResponse>(
      this.updateOrderItemUrl(),
      this.updateOrderItemPayload(payload.item.key, payload.quantity),
    );
    return success(await this.fetchCart(payload.cart.key || undefined));
  }

  @Reactionary({
    inputSchema: CartQueryListSchema,
    outputSchema: CartPaginatedSearchResultSchema,
  })
  public override async listCarts(
    payload: CartQueryList,
  ): Promise<
    Result<
      ReturnType<
        CartFactoryWithOutput<TFactory>['parseCartPaginatedSearchResult']
      >
    >
  > {
    debug('listCarts');
    const data = await this.client.callGet<HclWcsOrderListResponse>(
      this.orderListUrl(),
      undefined,
      { allowUndefined: true },
    );
    const orderList = data ?? { Order: [] };
    return success(
      this.factory.parseCartPaginatedSearchResult(
        this.context,
        orderList,
        payload,
      ),
    );
  }

  @Reactionary({
    inputSchema: CartMutationCreateCartSchema,
    outputSchema: CartSchema,
  })
  public override async createCart(
    payload: CartMutationCreateCart,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug('createCart name=%s', payload.name);
    // Create the order in WCS with the name as description so it persists.
    const result = await this.client.callPost<HclWcsCreateOrderResponse>(
      `${this.createOrderUrl()}?${this.createOrderParams(payload.name || undefined).toString()}`,
      {},
    );
    // Also store in session so the current request can read back the name.
    if (payload.name) {
      this.context.session['hcl.cartName'] = payload.name;
    }
    return success(await this.fetchCart(result.outOrderId));
  }

  @Reactionary({
    inputSchema: CartMutationDeleteCartSchema,
  })
  public override async deleteCart(
    payload: CartMutationDeleteCart,
  ): Promise<Result<void>> {
    debug('deleteCart %s', payload.cart.key);
    await this.client.callDelete(
      this.deleteCartUrl(payload.cart.key || undefined),
      {
        ignore404: true,
      },
    );
    return success(undefined);
  }

  @Reactionary({
    inputSchema: CartMutationRenameCartSchema,
    outputSchema: CartSchema,
  })
  public override async renameCart(
    payload: CartMutationRenameCart,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug('renameCart %s -> %s', payload.cart.key, payload.newName);
    if (payload.cart.key) {
      await this.fetchSetPendingOrder(payload.cart.key);
    }
    // Persist the new name to HCL as the order description.
    const wcsCart = await this.fetchWcsCart();
    const orderItem = (wcsCart.orderItem ?? []).map((item) => ({
      orderItemId: item.orderItemId,
      quantity: item.quantity,
    }));
    await this.client.callPut<unknown>(
      this.updateOrderDescriptionUrl(),
      this.updateOrderDescriptionPayload(payload.newName, orderItem),
    );
    // Keep session in sync so the current request reads back the new name.
    this.context.session['hcl.cartName'] = payload.newName;
    return success(await this.fetchCart(payload.cart.key || undefined));
  }

  @Reactionary({
    inputSchema: CartMutationApplyCouponSchema,
    outputSchema: CartSchema,
  })
  public override async applyCouponCode(
    payload: CartMutationApplyCoupon,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug('applyCouponCode %s cart=%s', payload.couponCode, payload.cart.key);
    if (payload.cart.key) {
      await this.fetchSetPendingOrder(payload.cart.key);
    }
    await this.client.callPost<void>(
      this.addPromotionCodeUrl(),
      this.addPromotionCodePayload(payload.couponCode),
    );
    return success(await this.fetchCart(payload.cart.key || undefined));
  }

  @Reactionary({
    inputSchema: CartMutationRemoveCouponSchema,
    outputSchema: CartSchema,
  })
  public override async removeCouponCode(
    payload: CartMutationRemoveCoupon,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug('removeCouponCode %s cart=%s', payload.couponCode, payload.cart.key);
    if (payload.cart.key) {
      await this.fetchSetPendingOrder(payload.cart.key);
    }
    await this.client.callDelete(
      this.removePromotionCodeUrl(payload.couponCode),
      {
        ignore404: true,
      },
    );
    return success(await this.fetchCart(payload.cart.key || undefined));
  }

  @Reactionary({
    inputSchema: CartMutationChangeCurrencySchema,
    outputSchema: CartSchema,
  })
  public override async changeCurrency(
    payload: CartMutationChangeCurrency,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug('changeCurrency %s cart=%s', payload.newCurrency, payload.cart.key);

    // Fetch the current cart to get its items and description.
    const oldCart = await this.fetchWcsCart(payload.cart.key || undefined);
    const oldOrderId = oldCart.orderId;

    // Create a new order with the target currency.
    const newOrder = await this.client.callPost<HclWcsCreateOrderResponse>(
      `${this.createOrderUrl()}?${this.createOrderParams(oldCart.orderDescription, payload.newCurrency).toString()}`,
      {},
    );

    // Make the new order the active (@self) one.
    await this.fetchSetPendingOrder(newOrder.outOrderId);

    // Copy all items from the old order into the new one, priced in the new
    // currency by passing it as a query param on the add-item POST.
    for (const item of oldCart.orderItem ?? []) {
      await this.client.callPost<HclWcsOrderItemUpdateResponse>(
        this.addOrderItemUrl(payload.newCurrency),
        this.addOrderItemPayload(item.partNumber, Number(item.quantity)),
      );
    }

    // Cancel the old order.
    await this.client.callDelete(this.deleteCartUrl(oldOrderId), {
      ignore404: true,
    });

    return success(await this.fetchCart(newOrder.outOrderId));
  }
}
