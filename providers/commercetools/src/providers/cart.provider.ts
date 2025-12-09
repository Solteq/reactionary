import {
  CartIdentifierSchema,
  CartItemSchema,
  CartMutationApplyCouponSchema,
  CartMutationChangeCurrencySchema,
  CartMutationDeleteCartSchema,
  CartMutationItemAddSchema,
  CartMutationItemQuantityChangeSchema,
  CartMutationItemRemoveSchema,
  CartMutationRemoveCouponSchema,
  CartProvider,
  CartQueryByIdSchema,
  CartSchema,
  Reactionary,
  success,
  error,
  unwrapValue,
  assertSuccess,
} from '@reactionary/core';
import type {
  CartItem,
  CartMutationItemAdd,
  CartMutationItemQuantityChange,
  CartMutationItemRemove,
  CartQueryById,
  CartIdentifier,
  CartMutationApplyCoupon,
  CartMutationDeleteCart,
  CartMutationRemoveCoupon,
  CartMutationChangeCurrency,
  RequestContext,
  Cart,
  Currency,
  Cache,
  CostBreakDown,
  Result,
  NotFoundError,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type {
  Cart as CTCart,
  LineItem,
  MyCartUpdateAction,
} from '@commercetools/platform-sdk';
import type { CommercetoolsCartIdentifier } from '../schema/commercetools.schema.js';
import { CommercetoolsCartIdentifierSchema } from '../schema/commercetools.schema.js';
import type { CommercetoolsClient } from '../core/client.js';

export class CommercetoolsCartProvider extends CartProvider {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(cache, context);

    this.config = config;
    this.client = client;
  }

  @Reactionary({
    inputSchema: CartQueryByIdSchema,
    outputSchema: CartSchema,
  })
  public override async getById(payload: CartQueryById): Promise<Result<Cart, NotFoundError>> {
    const client = await this.getClient();
    const ctId = payload.cart as CommercetoolsCartIdentifier;

    try {
      const remote = await client.carts.withId({ ID: ctId.key }).get().execute();

      return success(this.parseSingle(remote.body));
    } catch(err) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: ctId
      });
    }
  }

  @Reactionary({
    inputSchema: CartMutationItemAddSchema,
    outputSchema: CartSchema,
  })
  public override async add(payload: CartMutationItemAdd): Promise<Result<Cart>> {
    let cartIdentifier = payload.cart;
    if (!cartIdentifier) {
      cartIdentifier = await this.createCart();
    }

    const result = await this.applyActions(cartIdentifier, [
      {
        action: 'addLineItem',
        quantity: payload.quantity,
        sku: payload.variant.sku,
        // FIXME: This should be dynamic, probably as part of the context...
        distributionChannel: {
          typeId: 'channel',
          key: 'OnlineFfmChannel',
        },
      },
      {
        action: 'recalculate',
      },
    ]);

    return success(result);
  }

  @Reactionary({
    inputSchema: CartMutationItemRemoveSchema,
    outputSchema: CartSchema,
  })
  public override async remove(payload: CartMutationItemRemove): Promise<Result<Cart>> {
    const result = await this.applyActions(payload.cart, [
      {
        action: 'removeLineItem',
        lineItemId: payload.item.key,
      },
      {
        action: 'recalculate',
      },
    ]);

    return success(result);
  }

  @Reactionary({
    inputSchema: CartMutationItemQuantityChangeSchema,
    outputSchema: CartSchema,
  })
  public override async changeQuantity(
    payload: CartMutationItemQuantityChange
  ): Promise<Result<Cart>> {
    if (payload.quantity === 0) {
      // Changing quantity to 0 is not allowed. Use the remove call instead. This is done to avoid accidental removal of item.
      // Calls with quantity 0 will just be ignored.
      const existing = await this.getById({ cart: payload.cart });

      // TODO: Should we instead allow returning NotFound here, if that is indeed the case?
      assertSuccess(existing);

      return existing;
    }

    const result = await this.applyActions(payload.cart, [
      {
        action: 'changeLineItemQuantity',
        lineItemId: payload.item.key,
        quantity: payload.quantity,
      },
      {
        action: 'recalculate',
      },
    ]);

    return success(result);
  }

  @Reactionary({
    outputSchema: CartIdentifierSchema,
  })
  public override async getActiveCartId(): Promise<Result<CartIdentifier, NotFoundError>> {
    const client = await this.getClient();
    try {
      const carts = await client.activeCart.get().execute();
      const result = await CommercetoolsCartIdentifierSchema.parse({
        key: carts.body.id,
        version: carts.body.version || 0,
      });

      return success(result);
    } catch (e: any) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: {}
      })
    }
  }

  @Reactionary({
    inputSchema: CartMutationDeleteCartSchema,
    outputSchema: CartSchema,
  })
  public override async deleteCart(
    payload: CartMutationDeleteCart
  ): Promise<Result<void>> {
    const client = await this.getClient();
    if (payload.cart.key) {
      const ctId = payload.cart as CommercetoolsCartIdentifier;

      await client.carts
        .withId({ ID: ctId.key })
        .delete({
          queryArgs: {
            version: ctId.version,
            dataErasure: false,
          },
        })
        .execute();
    }

    return success(undefined);
  }

  @Reactionary({
    inputSchema: CartMutationApplyCouponSchema,
    outputSchema: CartSchema,
  })
  public override async  applyCouponCode(
    payload: CartMutationApplyCoupon
  ): Promise<Result<Cart>> {
    const result = await this.applyActions(payload.cart, [
      {
        action: 'addDiscountCode',
        code: payload.couponCode,
      },
      {
        action: 'recalculate',
      },
    ]);

    return success(result);
  }

  @Reactionary({
    inputSchema: CartMutationRemoveCouponSchema,
    outputSchema: CartSchema,
  })
  public override async removeCouponCode(
    payload: CartMutationRemoveCoupon
  ): Promise<Result<Cart>> {
    const result = await this.applyActions(payload.cart, [
      {
        action: 'removeDiscountCode',
        discountCode: {
          id: payload.couponCode,
          typeId: 'discount-code',
        },
      },
      {
        action: 'recalculate',
      },
    ]);

    return success(result);
  }

  @Reactionary({
    inputSchema: CartMutationChangeCurrencySchema,
    outputSchema: CartSchema,
  })
  public override async changeCurrency(
    payload: CartMutationChangeCurrency
  ): Promise<Result<Cart>> {
    // ok, to do this we have to actually build a new cart, copy over all the items, and then delete the old cart.
    // because Commercetools does not support changing currency of an existing cart.

    // This is obviously not ideal, but it is what it is.

    const client = await this.getClient();
    const currentCart = await client.carts
      .withId({ ID: payload.cart.key })
      .get()
      .execute();
    const newCart = await client.carts
      .post({
        body: {
          currency: payload.newCurrency,
          locale: this.context.languageContext.locale,
        },
      })
      .execute();

    const newCartId = CommercetoolsCartIdentifierSchema.parse({
      key: newCart.body.id,
      version: newCart.body.version || 0,
    });

    const cartItemAdds: MyCartUpdateAction[] = currentCart.body.lineItems.map(
      (item) => ({
        action: 'addLineItem',
        sku: item.variant.sku || '',
        quantity: item.quantity,
      })
    );

    const response = await this.applyActions(newCartId, [
      ...cartItemAdds,
      {
        action: 'recalculate',
      },
    ]);

    // now delete the old cart.
    await client.carts
      .withId({ ID: payload.cart.key })
      .delete({
        queryArgs: {
          version: currentCart.body.version || 0,
          dataErasure: false,
        },
      })
      .execute();

    return success(response);
  }

  protected async createCart(): Promise<CartIdentifier> {
    const client = await this.getClient();
    const response = await client.carts
      .post({
        body: {
          currency: this.context.languageContext.currencyCode || 'USD',
          country: this.context.taxJurisdiction.countryCode || 'US',
          locale: this.context.languageContext.locale,
        },
      })
      .execute();

    return CommercetoolsCartIdentifierSchema.parse({
      key: response.body.id,
      version: response.body.version || 0,
    });
  }

  protected async applyActions(
    cart: CartIdentifier,
    actions: MyCartUpdateAction[]
  ): Promise<Cart> {
    const client = await this.getClient();
    const ctId = cart as CommercetoolsCartIdentifier;

    try {
      const response = await client.carts
        .withId({ ID: ctId.key })
        .post({
          body: {
            version: ctId.version,
            actions,
          },
        })
        .execute();

      if (response.error) {
        console.error(response.error);
      }
      return this.parseSingle(response.body);
    } catch (e: any) {
      console.error('Error applying actions to cart:', e);
      throw e;
    }
  }

  /**
   * Creates a new Commercetools client, optionally upgrading it from Anonymous mode to Guest mode.
   * For now, any Query or Mutation will require an upgrade to Guest mode.
   * In the future, maybe we can delay this upgrade until we actually need it.
   */
  protected async getClient() {
    const client = await this.client.getClient();

    const clientWithProject = client.withProjectKey({
      projectKey: this.config.projectKey,
    });

    return {
      carts: clientWithProject.me().carts(),
      activeCart: clientWithProject.me().activeCart(),
      orders: clientWithProject.me().orders(),
    };
  }

  protected parseCartItem(remoteItem: LineItem): CartItem {
    const unitPrice = remoteItem.price.value.centAmount;
    const totalPrice = remoteItem.totalPrice.centAmount || 0;
    const totalDiscount = remoteItem.price.discounted?.value.centAmount || 0;
    const unitDiscount = totalDiscount / remoteItem.quantity;
    const currency =
      remoteItem.price.value.currencyCode.toUpperCase() as Currency;

    const item = {
      identifier: {
        key: remoteItem.id,
      },
      product: {
        key: remoteItem.productId,
      },
      variant: {
        sku: remoteItem.variant.sku || '',
      },
      quantity: remoteItem.quantity,
      price: {
        unitPrice: {
          value: unitPrice / 100,
          currency,
        },
        unitDiscount: {
          value: unitDiscount / 100,
          currency,
        },
        totalPrice: {
          value: (totalPrice || 0) / 100,
          currency,
        },
        totalDiscount: {
          value: totalDiscount / 100,
          currency,
        },
      },
    } satisfies CartItem;

    return CartItemSchema.parse(item);
  }

  protected parseSingle(remote: CTCart): Cart {
    const identifier = {
      key: remote.id,
      version: remote.version || 0,
    } satisfies CommercetoolsCartIdentifier;

    const grandTotal = remote.totalPrice.centAmount || 0;
    const shippingTotal = remote.shippingInfo?.price.centAmount || 0;
    const productTotal = grandTotal - shippingTotal;
    const taxTotal = remote.taxedPrice?.totalTax?.centAmount || 0;
    const discountTotal =
      remote.discountOnTotalPrice?.discountedAmount.centAmount || 0;
    const surchargeTotal = 0;
    const currency = remote.totalPrice.currencyCode as Currency;

    const price = {
      totalTax: {
        value: taxTotal / 100,
        currency,
      },
      totalDiscount: {
        value: discountTotal / 100,
        currency,
      },
      totalSurcharge: {
        value: surchargeTotal / 100,
        currency,
      },
      totalShipping: {
        value: shippingTotal / 100,
        currency,
      },
      totalProductPrice: {
        value: productTotal / 100,
        currency,
      },
      grandTotal: {
        value: grandTotal / 100,
        currency,
      },
    } satisfies CostBreakDown;

    const items = new Array<CartItem>();
    for (const remoteItem of remote.lineItems) {
      const item = this.parseCartItem(remoteItem);

      items.push(item);
    }

    const cart = {
      identifier,
      userId: {
        userId: '???',
      },
      name: remote.custom?.fields['name'] || '',
      description: remote.custom?.fields['description'] || '',
      price,
      items,
    } satisfies Cart;

    return cart;
  }
}
