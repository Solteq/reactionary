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

  /**
   * Set the specified order as the current pending (@self) order.
   * After this call, @self endpoints will operate on that orderId.
   */
  protected async fetchSetPendingOrder(orderId: string): Promise<void> {
    await this.client.callPost<unknown>(
      `${this.client.transactionBaseUrl}/cart/${encodeURIComponent(orderId)}/set_pending_order`,
      { orderId },
    );
  }

  /**
   * Fetch a specific order by ID directly from the Order API.
   * Does NOT call set_pending_order — safe to use for read-only access.
   * Throws HclCartNotFoundError on 404.
   */
  protected async fetchWcsOrder(orderId: string): Promise<HclWcsCartResponse> {
    const data = await this.client.callGet<HclWcsCartResponse>(
      `${this.client.transactionBaseUrl}/order/${encodeURIComponent(orderId)}`,
      undefined,
      { allowUndefined: true },
    );
    if (!data) throw new HclCartNotFoundError();
    return data;
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
      `${this.client.transactionBaseUrl}/cart/@self`,
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

  /** Add a SKU to the cart (creates the cart if it does not yet exist).
   * Pass `currency` to force the price calculation into that currency
   * (used when copying items to a new order during changeCurrency).
   */
  protected async fetchAddOrderItem(
    partNumber: string,
    quantity: number,
    currency?: string,
  ): Promise<HclWcsOrderItemUpdateResponse> {
    const qs = currency ? `?currency=${encodeURIComponent(currency)}` : '';
    return this.client.callPost<HclWcsOrderItemUpdateResponse>(
      `${this.client.transactionBaseUrl}/cart${qs}`,
      {
        orderItem: [{ partNumber, quantity: String(quantity) }],
        x_calculateOrder: '1',
        x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
      },
    );
  }

  /** Update the quantity of an existing cart item. */
  protected async fetchUpdateOrderItem(
    orderItemId: string,
    quantity: number,
  ): Promise<HclWcsOrderItemUpdateResponse> {
    return this.client.callPut<HclWcsOrderItemUpdateResponse>(
      `${this.client.transactionBaseUrl}/cart/@self/update_order_item`,
      {
        orderItem: [{ orderItemId, quantity: String(quantity) }],
        x_calculateOrder: '1',
        x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
      },
    );
  }

  /** Remove a single item from the cart. */
  protected async fetchDeleteOrderItem(orderItemId: string): Promise<void> {
    await this.client.callPut<void>(
      `${this.client.transactionBaseUrl}/cart/@self/delete_order_item`,
      {
        orderItemId,
        x_calculateOrder: '1',
        x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
      },
    );
  }

  /**
   * Delete (cancel) the specified order, or the current pending order.
   * If orderId is provided, cancels that specific order via its own endpoint.
   */
  protected async fetchDeleteCart(orderId?: string): Promise<void> {
    if (orderId) {
      return this.client.callDelete(
        `${this.client.transactionBaseUrl}/cart/${encodeURIComponent(orderId)}/cancel_order`,
        { ignore404: true },
      );
    }
    return this.client.callDelete(
      `${this.client.transactionBaseUrl}/cart/@self`,
      { ignore404: true },
    );
  }

  /**
   * Fetch a list of all pending orders from the Order API.
   * Calls GET /order/byStatus/P — returns all P-status orders for the current user.
   */
  protected async fetchWcsOrderList(): Promise<HclWcsOrderListResponse> {
    const data = await this.client.callGet<HclWcsOrderListResponse>(
      `${this.client.transactionBaseUrl}/order/byStatus/P`,
      undefined,
      { allowUndefined: true },
    );
    return data ?? { Order: [] };
  }

  /**
   * Create a new order in WCS with an optional description/name and currency.
   * Calls POST /cart/create_order?description={name}[&currency={currency}]
   */
  protected async fetchCreateOrder(
    description?: string,
    currency?: string,
  ): Promise<HclWcsCreateOrderResponse> {
    const params = new URLSearchParams();
    // description is mandatory for WCS create_order — default to empty string.
    params.set('description', description ?? '');
    if (currency) params.set('currency', currency);
    return this.client.callPost<HclWcsCreateOrderResponse>(
      `${this.client.transactionBaseUrl}/cart/create_order?${params.toString()}`,
      {},
    );
  }

  /**
   * Persist the cart description (name) to WCS via the update_order_item
   * endpoint. Must call fetchSetPendingOrder first if targeting a
   * non-current order.
   *
   */
  protected async fetchUpdateOrderDescription(
    description: string,
  ): Promise<void> {
    // WCS update_order_item requires an orderItem array in the body — include
    // the current items so the endpoint does not return HTTP 500.
    const cart = await this.fetchWcsCart();
    const orderItem = (cart.orderItem ?? []).map((item) => ({
      orderItemId: item.orderItemId,
      quantity: item.quantity,
    }));
    await this.client.callPut<unknown>(
      `${this.client.transactionBaseUrl}/cart/@self/update_order_item`,
      {
        orderDescription: description,
        orderItem,
        x_calculateOrder: '1',
        x_calculationUsage: '-1,-2,-3,-4,-5,-6,-7',
      },
    );
  }

  /** Apply a promotion/coupon code to the cart. */
  protected async fetchAddPromotionCode(code: string): Promise<void> {
    await this.client.callPost<void>(
      `${this.client.transactionBaseUrl}/cart/@self/assigned_promotion_code`,
      { promoCode: code },
    );
  }

  /** Remove a promotion/coupon code from the cart. */
  protected async fetchRemovePromotionCode(code: string): Promise<void> {
    return this.client.callDelete(
      `${this.client.transactionBaseUrl}/cart/@self/assigned_promotion_code/${encodeURIComponent(code)}`,
      { ignore404: true },
    );
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
    await this.fetchAddOrderItem(payload.variant.sku, payload.quantity);
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
    await this.fetchDeleteOrderItem(payload.item.key);
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
    await this.fetchUpdateOrderItem(payload.item.key, payload.quantity);
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
    const orderList = await this.fetchWcsOrderList();
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
    const result = await this.fetchCreateOrder(payload.name || undefined);
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
    await this.fetchDeleteCart(payload.cart.key || undefined);
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
    await this.fetchUpdateOrderDescription(payload.newName);
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
    await this.fetchAddPromotionCode(payload.couponCode);
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
    await this.fetchRemovePromotionCode(payload.couponCode);
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
    const newOrder = await this.fetchCreateOrder(
      oldCart.orderDescription,
      payload.newCurrency,
    );

    // Make the new order the active (@self) one.
    await this.fetchSetPendingOrder(newOrder.outOrderId);

    // Copy all items from the old order into the new one, priced in the new
    // currency by passing it as a query param on the add-item POST.
    for (const item of oldCart.orderItem ?? []) {
      await this.fetchAddOrderItem(
        item.partNumber,
        Number(item.quantity),
        payload.newCurrency,
      );
    }

    // Cancel the old order.
    await this.fetchDeleteCart(oldOrderId);

    return success(await this.fetchCart(newOrder.outOrderId));
  }
}
