import {
  type Cache,
  type CartFactory,
  type CartFactoryCartOutput,
  type CartFactoryWithOutput,
  type CartIdentifier,
  type CartMutationApplyCoupon,
  type CartMutationChangeCurrency,
  type CartMutationCreateCart,
  type CartMutationDeleteCart,
  type CartMutationItemAdd,
  type CartMutationItemQuantityChange,
  type CartMutationItemRemove,
  type CartMutationRemoveCoupon,
  type CartMutationRenameCart,
  type CartPaginatedSearchResult,
  type CartQueryById,
  type CartQueryList,
  type NotFoundError,
  type RequestContext,
  type Result,
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
  success,
  error,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoClient, RequestContextTokenStore } from '../core/client.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import { MagentoCartIdentifierSchema, type MagentoCartIdentifier } from '../schema/magento.schema.js';
import type { MagentoCartFactory } from '../factories/cart/cart.factory.js';

const debug = createDebug('reactionary:magento:cart');

export class MagentoCartCapability<
  TFactory extends CartFactory = MagentoCartFactory,
> extends CartCapability<CartFactoryCartOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: CartFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: CartFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: CartQueryByIdSchema,
    outputSchema: CartSchema,
  })
  public override async getById(
    payload: CartQueryById,
  ): Promise<Result<CartFactoryCartOutput<TFactory>, NotFoundError>> {
    try {
      const magentoId = payload.cart as MagentoCartIdentifier;
      const cartResponse = await this.getCartWithTotals(magentoId.key);

      if (cartResponse) {
        return success(this.factory.parseCart(this.context, { ...cartResponse, _requestedId: magentoId.key }));
      }

      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    } catch (err) {
      debug('Failed to get cart by ID:', err);
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    }
  }

  @Reactionary({
    inputSchema: CartMutationItemAddSchema,
    outputSchema: CartSchema,
  })
  public override async add(
    payload: CartMutationItemAdd,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      let cartIdentifier = payload.cart;
      if (!cartIdentifier) {
        const activeCart = await this.getActiveCartId();
        if (activeCart.success) {
          cartIdentifier = activeCart.value;
        } else {
          cartIdentifier = await this.createNewCart();
        }
      }

      const magentoId = cartIdentifier as MagentoCartIdentifier;
      const item = {
        sku: payload.variant.sku,
        qty: payload.quantity,
      };

      await this.magentoApi.addItemToCart(magentoId.key, item);

      const cartResponse = await this.getCartWithTotals(magentoId.key);
      return success(this.factory.parseCart(this.context, { ...cartResponse, _requestedId: magentoId.key }));
    } catch (err) {
      debug('Failed to add item to cart:', err);
      throw err;
    }
  }

  @Reactionary({
    inputSchema: CartMutationItemRemoveSchema,
    outputSchema: CartSchema,
  })
  public override async remove(
    payload: CartMutationItemRemove,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const magentoId = payload.cart as MagentoCartIdentifier;
      await this.magentoApi.removeCartItem(magentoId.key, Number(payload.item.key));

      const cartResponse = await this.getCartWithTotals(magentoId.key);
      return success(this.factory.parseCart(this.context, { ...cartResponse, _requestedId: magentoId.key }));
    } catch (err) {
      debug('Failed to remove item from cart:', err);
      throw err;
    }
  }

  @Reactionary({
    inputSchema: CartMutationItemQuantityChangeSchema,
    outputSchema: CartSchema,
  })
  public override async changeQuantity(
    payload: CartMutationItemQuantityChange,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const magentoId = payload.cart as MagentoCartIdentifier;
      const item = {
        item_id: Number(payload.item.key),
        qty: payload.quantity,
      };

      await this.magentoApi.updateCartItem(magentoId.key, Number(payload.item.key), item);

      const cartResponse = await this.getCartWithTotals(magentoId.key);
      return success(this.factory.parseCart(this.context, { ...cartResponse, _requestedId: magentoId.key }));
    } catch (err) {
      debug('Failed to change quantity:', err);
      throw err;
    }
  }

  @Reactionary({
    outputSchema: CartIdentifierSchema,
  })
  public override async getActiveCartId(): Promise<
    Result<CartIdentifier, NotFoundError>
  > {
    try {
      const tokenStore = (this.magentoApi as unknown as { tokenStore: RequestContextTokenStore }).tokenStore;
      const activeCartId = await tokenStore.getItem('activeCartId');

      if (activeCartId) {
        return success(
          MagentoCartIdentifierSchema.parse({
            key: activeCartId,
          }),
        );
      }

      return error<NotFoundError>({
        type: 'NotFound',
        identifier: undefined,
      });
    } catch {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: undefined,
      });
    }
  }

  @Reactionary({
    inputSchema: CartMutationDeleteCartSchema,
    outputSchema: CartSchema,
  })
  public override async deleteCart(
    _payload: CartMutationDeleteCart,
  ): Promise<Result<void>> {
    const tokenStore = (this.magentoApi as unknown as { tokenStore: RequestContextTokenStore }).tokenStore;
    await tokenStore.removeItem('activeCartId');
    return success(undefined);
  }

  @Reactionary({
    inputSchema: CartMutationApplyCouponSchema,
    outputSchema: CartSchema,
  })
  public override async applyCouponCode(
    payload: CartMutationApplyCoupon,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const magentoId = payload.cart as MagentoCartIdentifier;
      await this.magentoApi.applyCoupon(magentoId.key, payload.couponCode);

      const cartResponse = await this.getCartWithTotals(magentoId.key);
      return success(this.factory.parseCart(this.context, { ...cartResponse, _requestedId: magentoId.key }));
    } catch (err) {
      debug('Failed to apply coupon:', err);
      throw err;
    }
  }

  @Reactionary({
    inputSchema: CartMutationRemoveCouponSchema,
    outputSchema: CartSchema,
  })
  public override async removeCouponCode(
    payload: CartMutationRemoveCoupon,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const magentoId = payload.cart as MagentoCartIdentifier;
      await this.magentoApi.removeCoupon(magentoId.key);

      const cartResponse = await this.getCartWithTotals(magentoId.key);
      return success(this.factory.parseCart(this.context, { ...cartResponse, _requestedId: magentoId.key }));
    } catch (err) {
      debug('Failed to remove coupon:', err);
      throw err;
    }
  }

  @Reactionary({
    inputSchema: CartMutationChangeCurrencySchema,
    outputSchema: CartSchema,
  })
  public override async changeCurrency(
    _payload: CartMutationChangeCurrency,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    throw new Error('Currency change not implemented for Magento');
  }

  @Reactionary({
    inputSchema: CartQueryListSchema,
    outputSchema: CartPaginatedSearchResultSchema,
  })
  public override async listCarts(
    _payload: CartQueryList,
  ): Promise<Result<CartPaginatedSearchResult>> {

    const tokenStore = (this.magentoApi as unknown as { tokenStore: RequestContextTokenStore }).tokenStore;
    const activeCartId = await tokenStore.getItem('activeCartId');

    if (activeCartId) {
      const cartWithTotals = await this.getCartWithTotals(activeCartId);

      return success(this.factory.parseCartPaginatedSearchResult(this.context, {
        items: [cartWithTotals],
        totalCount: 1,
      }, _payload));
    } else {
      return success(this.factory.parseCartPaginatedSearchResult(this.context, {
        items: [],
        totalCount: 0,
      }, _payload));
    }
  }

  @Reactionary({
    inputSchema: CartMutationCreateCartSchema,
    outputSchema: CartSchema,
  })
  public override async createCart(
    _payload: CartMutationCreateCart,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const identifier = await this.createNewCart();
    const cartResponse = await this.getCartWithTotals((identifier as MagentoCartIdentifier).key);
    return success(this.factory.parseCart(this.context, { ...cartResponse, _requestedId: (identifier as MagentoCartIdentifier).key }));
  }

  @Reactionary({
    inputSchema: CartMutationRenameCartSchema,
    outputSchema: CartSchema,
  })
  public override async renameCart(
    _payload: CartMutationRenameCart,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    throw new Error('renameCart not implemented for Magento');
  }

  protected async createNewCart(): Promise<CartIdentifier> {
    const cartId = await this.magentoApi.createCart();
    const identifier = MagentoCartIdentifierSchema.parse({
      key: cartId.replace(/^"|"$/g, ''),
    });

    const tokenStore = (this.magentoApi as unknown as { tokenStore: RequestContextTokenStore }).tokenStore;
    await tokenStore.setItem('activeCartId', identifier.key);

    return identifier;
  }

  protected async getCartWithTotals(cartId: string): Promise<Record<string, unknown>> {
    try {
      const [cartResponse, totalsResponse] = await Promise.all([
        this.magentoApi.getCart(cartId),
        this.magentoApi.getCartTotals(cartId),
      ]);

      return {
        ...cartResponse,
        ...totalsResponse,
        items: ((cartResponse.items || []) as Array<Record<string, unknown>>).map((item) => {
          const totalItem = ((totalsResponse.items || []) as Array<Record<string, unknown>>).find(
            (t) => t['item_id'] === item['item_id'],
          );
          return { ...item, ...totalItem };
        }),
      };
    } catch (err) {
      debug('Failed to get cart with totals:', err);
      return this.magentoApi.getCart(cartId);
    }
  }
}
