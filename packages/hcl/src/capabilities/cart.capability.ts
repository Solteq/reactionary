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
import type { HclConfiguration } from '../schema/configuration.schema.js';
import { HclCartNotFoundError, type HclClient } from '../core/client.js';
import type { HclCartFactory } from '../factories/cart/cart.factory.js';
import type {
  HclWcsCartResponse,
  HclWcsOrderItemUpdateResponse,
} from '../schema/hcl.schema.js';
import createDebug from 'debug';

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

  /** Fetch the raw WCS cart response. Throws HclCartNotFoundError on 404. */
  protected async fetchWcsCart(): Promise<HclWcsCartResponse> {
    const data = await this.client.callGet<HclWcsCartResponse>(
      `${this.client.transactionBaseUrl}/cart/@self`,
      undefined,
      { allowUndefined: true },
    );
    if (!data) throw new HclCartNotFoundError();
    return data;
  }

  /** Fetch and parse the current cart via the factory. */
  protected async fetchCart(): Promise<CartFactoryCartOutput<TFactory>> {
    const data = await this.fetchWcsCart();
    return this.factory.parseCart(this.context, data);
  }

  /** Add a SKU to the cart (creates the cart if it does not yet exist). */
  protected async fetchAddOrderItem(
    partNumber: string,
    quantity: number,
  ): Promise<HclWcsOrderItemUpdateResponse> {
    return this.client.callPost<HclWcsOrderItemUpdateResponse>(
      `${this.client.transactionBaseUrl}/cart`,
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

  /** Delete (cancel) the entire active cart. */
  protected async fetchDeleteCart(): Promise<void> {
    return this.client.callDelete(
      `${this.client.transactionBaseUrl}/cart/@self`,
      { ignore404: true },
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
    _payload: CartQueryById,
  ): Promise<Result<CartFactoryCartOutput<TFactory>, NotFoundError>> {
    debug('getById');
    try {
      const cart = await this.fetchCart();
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
    debug('add %s x%d', payload.variant.sku, payload.quantity);
    await this.fetchAddOrderItem(payload.variant.sku, payload.quantity);
    return success(await this.fetchCart());
  }

  @Reactionary({
    inputSchema: CartMutationItemRemoveSchema,
    outputSchema: CartSchema,
  })
  public override async remove(
    payload: CartMutationItemRemove,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug('remove orderItemId=%s', payload.item.key);
    await this.fetchDeleteOrderItem(payload.item.key);
    return success(await this.fetchCart());
  }

  @Reactionary({
    inputSchema: CartMutationItemQuantityChangeSchema,
    outputSchema: CartSchema,
  })
  public override async changeQuantity(
    payload: CartMutationItemQuantityChange,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug(
      'changeQuantity orderItemId=%s qty=%d',
      payload.item.key,
      payload.quantity,
    );
    await this.fetchUpdateOrderItem(payload.item.key, payload.quantity);
    return success(await this.fetchCart());
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
    try {
      const data = await this.fetchWcsCart();
      return success(
        this.factory.parseCartPaginatedSearchResult(
          this.context,
          data,
          payload,
        ),
      );
    } catch (err) {
      if (err instanceof HclCartNotFoundError) {
        // No active cart — return empty paginated result.
        return success(
          this.factory.parseCartPaginatedSearchResult(
            this.context,
            { orderId: '' },
            payload,
          ),
        );
      }
      throw err;
    }
  }

  @Reactionary({
    inputSchema: CartMutationCreateCartSchema,
    outputSchema: CartSchema,
  })
  public override async createCart(
    payload: CartMutationCreateCart,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug('createCart name=%s', payload.name);
    if (payload.name) {
      this.context.session['hcl.cartName'] = payload.name;
    }
    // WCS creates the cart lazily on the first addOrderItem call.
    // Return a virtual empty cart so callers have something to work with.
    const userId =
      (this.context.session['hcl.userId'] as string | undefined) ?? '';
    const currency =
      (this.context.session['hcl.currency'] as string | undefined) ??
      this.config.defaultCurrency ??
      'USD';
    const zeroAmount = { value: 0, currency };
    const emptyCart = this.factory.cartSchema.parse({
      identifier: { key: '' },
      user: { userId },
      name: payload.name ?? '',
      price: {
        grandTotal: zeroAmount,
        totalProductPrice: zeroAmount,
        totalShipping: zeroAmount,
        totalTax: zeroAmount,
        totalDiscount: zeroAmount,
        totalSurcharge: zeroAmount,
      },
      company: payload.company
        ? { taxIdentifier: payload.company.taxIdentifier }
        : undefined,
    }) as CartFactoryCartOutput<TFactory>;
    return success(emptyCart);
  }

  @Reactionary({
    inputSchema: CartMutationDeleteCartSchema,
  })
  public override async deleteCart(
    _payload: CartMutationDeleteCart,
  ): Promise<Result<void>> {
    debug('deleteCart');
    await this.fetchDeleteCart();
    return success(undefined);
  }

  @Reactionary({
    inputSchema: CartMutationRenameCartSchema,
    outputSchema: CartSchema,
  })
  public override async renameCart(
    payload: CartMutationRenameCart,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug('renameCart newName=%s', payload.newName);
    this.context.session['hcl.cartName'] = payload.newName;
    return success(await this.fetchCart());
  }

  @Reactionary({
    inputSchema: CartMutationApplyCouponSchema,
    outputSchema: CartSchema,
  })
  public override async applyCouponCode(
    payload: CartMutationApplyCoupon,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug('applyCouponCode %s', payload.couponCode);
    await this.fetchAddPromotionCode(payload.couponCode);
    return success(await this.fetchCart());
  }

  @Reactionary({
    inputSchema: CartMutationRemoveCouponSchema,
    outputSchema: CartSchema,
  })
  public override async removeCouponCode(
    payload: CartMutationRemoveCoupon,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug('removeCouponCode %s', payload.couponCode);
    await this.fetchRemovePromotionCode(payload.couponCode);
    return success(await this.fetchCart());
  }

  @Reactionary({
    inputSchema: CartMutationChangeCurrencySchema,
    outputSchema: CartSchema,
  })
  public override async changeCurrency(
    payload: CartMutationChangeCurrency,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    debug('changeCurrency %s', payload.newCurrency);
    // Store the currency preference in session; it will be passed as a query
    // param on subsequent getCart calls via buildParams.
    this.context.session['hcl.currency'] = payload.newCurrency;
    return success(await this.fetchCart());
  }
}
