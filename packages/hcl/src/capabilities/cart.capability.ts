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
import type { HclTransactionClient } from '../core/transaction-client.js';
import {
  HclCartNotFoundError,
  getWcsAuthFromContext,
} from '../core/transaction-client.js';
import type { HclCartFactory } from '../factories/cart/cart.factory.js';
import { getLocaleParams } from '../core/locale-params.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:hcl:cart');

export class HclCartCapability<
  TFactory extends CartFactory = HclCartFactory,
> extends CartCapability<
  CartFactoryCartOutput<TFactory>,
  CartFactoryIdentifierOutput<TFactory>
> {
  protected config: HclConfiguration;
  protected transactionClient: HclTransactionClient;
  protected factory: CartFactoryWithOutput<TFactory>;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: HclConfiguration,
    transactionClient: HclTransactionClient,
    factory: CartFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.transactionClient = transactionClient;
    this.factory = factory;
  }

  /** Fetch the current cart and parse it via the factory. */
  private async fetchCart(): Promise<CartFactoryCartOutput<TFactory>> {
    const auth = getWcsAuthFromContext(this.context);
    const { currency } = getLocaleParams(this.config, this.context);
    const data = await this.transactionClient.getCart({ currency }, auth);
    return this.factory.parseCart(this.context, data);
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
      const auth = getWcsAuthFromContext(this.context);
      const { currency } = getLocaleParams(this.config, this.context);
      const data = await this.transactionClient.getCart({ currency }, auth);
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
    const auth = getWcsAuthFromContext(this.context);
    await this.transactionClient.addOrderItem(
      payload.variant.sku,
      payload.quantity,
      auth,
    );
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
    const auth = getWcsAuthFromContext(this.context);
    await this.transactionClient.deleteOrderItem(payload.item.key, auth);
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
    const auth = getWcsAuthFromContext(this.context);
    await this.transactionClient.updateOrderItem(
      payload.item.key,
      payload.quantity,
      auth,
    );
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
      const auth = getWcsAuthFromContext(this.context);
      const { currency } = getLocaleParams(this.config, this.context);
      const data = await this.transactionClient.getCart({ currency }, auth);
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
    const auth = getWcsAuthFromContext(this.context);
    await this.transactionClient.deleteCart(auth);
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
    const auth = getWcsAuthFromContext(this.context);
    await this.transactionClient.addPromotionCode(payload.couponCode, auth);
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
    const auth = getWcsAuthFromContext(this.context);
    await this.transactionClient.removePromotionCode(payload.couponCode, auth);
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
    // param on subsequent getCart calls via getLocaleParams.
    this.context.session['hcl.currency'] = payload.newCurrency;
    return success(await this.fetchCart());
  }
}
