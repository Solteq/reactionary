import {
  CartItemSchema,
  CartProvider,
  Cache
} from '@reactionary/core';
import type {
  CartMutationItemAdd,
  CartMutationItemQuantityChange,
  CartMutationItemRemove,
  CartQueryById,
  CartIdentifier, CartMutationApplyCoupon,
  CartMutationCheckout,
  CartMutationDeleteCart,
  CartMutationRemoveCoupon, CartMutationSetBillingAddress,
  CartMutationSetShippingInfo,
  CartMutationChangeCurrency, OrderIdentifier,
  RequestContext,
  Cart,
  Currency
} from '@reactionary/core';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { z } from 'zod';
import { CommercetoolsClient } from '../core/client';
import type {
  Cart as CTCart,
  MyCartUpdateAction,
} from '@commercetools/platform-sdk';
import { traced } from '@reactionary/otel';
import type {
  CommercetoolsCartIdentifier} from '../schema/commercetools.schema';
import {
  CommercetoolsCartIdentifierSchema,
  CommercetoolsOrderIdentifierSchema,
} from '../schema/commercetools.schema';

export class CommercetoolsCartProvider<
  T extends Cart = Cart
> extends CartProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache
  ) {
    super(schema, cache);
    this.config = config;
  }

  @traced()
  public override async getById(
    payload: CartQueryById,
    reqCtx: RequestContext
  ): Promise<T> {
    try {
      const client = await this.getClient(reqCtx);

      const ctId = payload.cart as CommercetoolsCartIdentifier;

      const remote = await client.carts.withId({ ID: ctId.key }).get().execute();

      return this.parseSingle(remote.body, reqCtx);
    } catch (e) {
      return this.createEmptyCart();
    }
  }

  @traced()
  public override async add(
    payload: CartMutationItemAdd,
    reqCtx: RequestContext
  ): Promise<T> {
    const client = await this.getClient(reqCtx);

    let cartIdentifier = payload.cart;
    if (!cartIdentifier.key) {
      cartIdentifier = await this.createCart(reqCtx);
    }

    return this.applyActions(
      cartIdentifier,
      [
        {
          action: 'addLineItem',
          quantity: payload.quantity,
          sku: payload.sku.key,
        },
        {
          action: 'recalculate',
        },
      ],
      reqCtx
    );
  }

  @traced()
  public override async remove(
    payload: CartMutationItemRemove,
    reqCtx: RequestContext
  ): Promise<T> {
    return this.applyActions(
      payload.cart,
      [
        {
          action: 'removeLineItem',
          lineItemId: payload.item.key,
        },
        {
          action: 'recalculate',
        },
      ],
      reqCtx
    );
  }

  @traced()
  public override async changeQuantity(
    payload: CartMutationItemQuantityChange,
    reqCtx: RequestContext
  ): Promise<T> {
    if (payload.quantity === 0) {
      // Changing quantity to 0 is not allowed. Use the remove call instead. This is done to avoid accidental removal of item.
      // Calls with quantity 0 will just be ignored.
      return this.getById({ cart: payload.cart }, reqCtx);
    }

    return this.applyActions(
      payload.cart,
      [
        {
          action: 'changeLineItemQuantity',
          lineItemId: payload.item.key,
          quantity: payload.quantity,
        },
        {
          action: 'recalculate',
        },
      ],
      reqCtx
    );
  }

  @traced()
  public override async getActiveCartId(
    reqCtx: RequestContext
  ): Promise<CartIdentifier> {
    const client = await this.getClient(reqCtx);
    try {
      const carts = await client.activeCart
        .get()
        .execute();

      return CommercetoolsCartIdentifierSchema.parse({
        key: carts.body.id,
        version: carts.body.version || 0
      });
    } catch (e: any) {
      return CommercetoolsCartIdentifierSchema.parse({
        key: '',
      version: 0
      });
    }
  }

  @traced()
  public override async deleteCart(
    payload: CartMutationDeleteCart,
    reqCtx: RequestContext
  ): Promise<T> {
    const client = await this.getClient(reqCtx);
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

    const activeCartId = await this.getActiveCartId(reqCtx);
    return this.getById({ cart: activeCartId }, reqCtx);
  }

  @traced()
  public override async setShippingInfo(
    payload: CartMutationSetShippingInfo,
    reqCtx: RequestContext
  ): Promise<T> {
    const client = await this.getClient(reqCtx);
    const ctId = payload.cart as CommercetoolsCartIdentifier;

    const actions: MyCartUpdateAction[] = new Array<MyCartUpdateAction>();
    if (payload.shippingMethod) {
      actions.push({
        action: 'setShippingMethod',
        shippingMethod: {
          typeId: 'shipping-method',
          id: payload.shippingMethod.key,
        },
      });
    }

    if (payload.shippingAddress) {
      actions.push({
        action: 'setShippingAddress',
        address: {
          country: payload.shippingAddress.countryCode || reqCtx.taxJurisdiction.countryCode || 'US',
          firstName: payload.shippingAddress.firstName,
          lastName: payload.shippingAddress.lastName,
          city: payload.shippingAddress.city,
          postalCode: payload.shippingAddress.postalCode,
          streetName: payload.shippingAddress.streetAddress,
          streetNumber: payload.shippingAddress.streetNumber,
        },
      });
    }

    return this.applyActions(payload.cart, actions, reqCtx);
  }

  @traced()
  public override setBillingAddress(
    payload: CartMutationSetBillingAddress,
    reqCtx: RequestContext
  ): Promise<T> {
    return this.applyActions(
      payload.cart,
      [
        {
          action: 'setBillingAddress',
          address: {
            email: payload.notificationEmailAddress,
            mobile: payload.notificationPhoneNumber,
            country: payload.billingAddress.countryCode || reqCtx.taxJurisdiction.countryCode || 'US',
            firstName: payload.billingAddress.firstName,
            lastName: payload.billingAddress.lastName,
            city: payload.billingAddress.city,
            postalCode: payload.billingAddress.postalCode,
            streetName: payload.billingAddress.streetAddress,
            streetNumber: payload.billingAddress.streetNumber,
          },
        },
        {
          action: 'setCustomerEmail',
          email: payload.notificationEmailAddress,
        },
        {
          action: 'setCountry',
          country: payload.billingAddress.countryCode || reqCtx.taxJurisdiction.countryCode || 'US',
        },
      ],
      reqCtx
    );
  }

  @traced()
  public override applyCouponCode(
    payload: CartMutationApplyCoupon,
    reqCtx: RequestContext
  ): Promise<T> {
    return this.applyActions(
      payload.cart,
      [
        {
          action: 'addDiscountCode',
          code: payload.couponCode,
        },
        {
          action: 'recalculate',
        },
      ],
      reqCtx
    );
  }

  @traced()
  public override removeCouponCode(
    payload: CartMutationRemoveCoupon,
    reqCtx: RequestContext
  ): Promise<T> {
    return this.applyActions(
      payload.cart,
      [
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
      ],
      reqCtx
    );
  }

  @traced()
  public override async checkout(
    payload: CartMutationCheckout,
    reqCtx: RequestContext
  ): Promise<OrderIdentifier> {
    // In Commercetools, checkout is done by creating an order from the cart.

    const client = await this.getClient(reqCtx);
    const ctId = payload.cart as CommercetoolsCartIdentifier;

    const orderResponse = await client.orders
      .post({
        body: {
          version: ctId.version,
          id: ctId.key,
        }
      })
      .execute();
    return CommercetoolsOrderIdentifierSchema.parse({
      key: orderResponse.body.id,
      version: orderResponse.body.version || 0,
    });
  }

  @traced()
  public override async changeCurrency(
    payload: CartMutationChangeCurrency,
    reqCtx: RequestContext
  ): Promise<T> {
    // ok, to do this we have to actually build a new cart, copy over all the items, and then delete the old cart.
    // because Commercetools does not support changing currency of an existing cart.

    // This is obviously not ideal, but it is what it is.

    const client = await this.getClient(reqCtx);
    const currentCart = await client.carts
      .withId({ ID: payload.cart.key })
      .get()
      .execute();
    const newCart = await client.carts
      .post({
        body: {
          currency: payload.newCurrency,
          locale: reqCtx.languageContext.locale,
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

    const response = await this.applyActions(
      newCartId,
      [
        ...cartItemAdds,
        {
          action: 'recalculate',
        },
      ],
      reqCtx
    );

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

    return response;
  }

  protected async createCart(reqCtx: RequestContext): Promise<CartIdentifier> {
    const client = await this.getClient(reqCtx);
    const response = await client.carts
      .post({
        body: {
          currency: reqCtx.languageContext.currencyCode || 'USD',
          country: reqCtx.taxJurisdiction.countryCode || 'US',
          locale: reqCtx.languageContext.locale,
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
    actions: MyCartUpdateAction[],
    reqCtx: RequestContext
  ): Promise<T> {
    const client = await this.getClient(reqCtx);
    const ctId = cart as CommercetoolsCartIdentifier;



        const response = await client.carts
          .withId({ ID: ctId.key })
          .post({
            body: {
              version: ctId.version,
              actions,
            },
          })
          .execute();

          return this.parseSingle(response.body, reqCtx);

  }

  /**
   * Creates a new Commercetools client, optionally upgrading it from Anonymous mode to Guest mode.
   * For now, any Query or Mutation will require an upgrade to Guest mode.
   * In the future, maybe we can delay this upgrade until we actually need it.
   *
   * @param reqCtx
   * @param anonymousCall
   * @returns
   */
  @traced()
  protected async getClient(reqCtx: RequestContext) {
    const client = await new CommercetoolsClient(this.config).getClient(reqCtx);

    const clientWithProject = client.withProjectKey({ projectKey: this.config.projectKey });
    return {
      carts: clientWithProject.me().carts(),
      activeCart: clientWithProject.me().activeCart(),
      orders: clientWithProject.me().orders(),

    }
  }

  protected override parseSingle(remote: CTCart, reqCtx: RequestContext): T {
    const result = this.newModel();

    result.identifier = CommercetoolsCartIdentifierSchema.parse({
      key: remote.id,
      version: remote.version || 0,
    });

    result.name = remote.custom?.fields['name'] || '';
    result.description = remote.custom?.fields['description'] || '';

    const grandTotal = remote.totalPrice.centAmount || 0;
    const shippingTotal = remote.shippingInfo?.price.centAmount || 0;
    const productTotal = grandTotal - shippingTotal;
    const taxTotal = remote.taxedPrice?.totalTax?.centAmount || 0;
    const discountTotal =
      remote.discountOnTotalPrice?.discountedAmount.centAmount || 0;
    const surchargeTotal = 0;
    const currency = remote.totalPrice.currencyCode as Currency;

    result.price = {
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
        currency: remote.shippingInfo?.price.currencyCode as Currency,
      },
      totalProductPrice: {
        value: productTotal / 100,
        currency,
      },
      grandTotal: {
        value: grandTotal / 100,
        currency,
      },
    };

    for (const remoteItem of remote.lineItems) {
      const item = CartItemSchema.parse({});

      item.identifier.key = remoteItem.id;
      item.product.key = remoteItem.productId;
      item.sku.key = remoteItem.variant.sku || '';
      item.quantity = remoteItem.quantity;

      const unitPrice = remoteItem.price.value.centAmount;
      const totalPrice = remoteItem.totalPrice.centAmount || 0;
      const totalDiscount = remoteItem.price.discounted?.value.centAmount || 0;
      const unitDiscount = totalDiscount / remoteItem.quantity;

      item.price = {
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
      };

      result.items.push(item);
    }

    result.meta = {
      cache: {
        hit: false,
        key: this.generateCacheKeySingle(result.identifier, reqCtx),
      },
      placeholder: false,
    };

    return this.assert(result);
  }
}
