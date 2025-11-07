import { CartItemSchema, CartProvider } from '@reactionary/core';
import type {
  CartMutationItemAdd,
  CartMutationItemQuantityChange,
  CartMutationItemRemove,
  CartQueryById,
  CartIdentifier,
  CartMutationApplyCoupon,
  CartMutationCheckout,
  CartMutationDeleteCart,
  CartMutationRemoveCoupon,
  CartMutationSetBillingAddress,
  CartMutationSetShippingInfo,
  CartMutationChangeCurrency,
  OrderIdentifier,
  RequestContext,
  Cart,
  Currency,
  Cache,
} from '@reactionary/core';

import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { z } from 'zod';
import type {
  ApiRoot,
  Cart as CTCart,
  MyCartUpdateAction,
} from '@commercetools/platform-sdk';
import type { CommercetoolsCartIdentifier } from '../schema/commercetools.schema.js';
import {
  CommercetoolsCartIdentifierSchema,
  CommercetoolsOrderIdentifierSchema,
} from '../schema/commercetools.schema.js';
import type { CommercetoolsClient } from '../core/client.js';

export class CommercetoolsCartProvider<
  T extends Cart = Cart
> extends CartProvider<T> {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(schema, cache, context);

    this.config = config;
    this.client = client;
  }

  public override async getById(payload: CartQueryById): Promise<T> {
    try {
      const client = await this.getClient();

      const ctId = payload.cart as CommercetoolsCartIdentifier;

      const remote = await client.carts
        .withId({ ID: ctId.key })
        .get()
        .execute();

      return this.parseSingle(remote.body);
    } catch (e) {
      return this.createEmptyCart();
    }
  }

  public override async add(payload: CartMutationItemAdd): Promise<T> {
    let cartIdentifier = payload.cart;
    if (!cartIdentifier.key) {
      cartIdentifier = await this.createCart();
    }

    return this.applyActions(cartIdentifier, [
      {
        action: 'addLineItem',
        quantity: payload.quantity,
        sku: payload.variant.sku,
        // FIXME: This should be dynamic, probably as part of the context...
        distributionChannel: {
          typeId: 'channel',
          key: 'OnlineFfmChannel'
        }
      },
      {
        action: 'recalculate',
      },
    ]);
  }

  public override async remove(payload: CartMutationItemRemove): Promise<T> {
    return this.applyActions(payload.cart, [
      {
        action: 'removeLineItem',
        lineItemId: payload.item.key,
      },
      {
        action: 'recalculate',
      },
    ]);
  }

  public override async changeQuantity(
    payload: CartMutationItemQuantityChange
  ): Promise<T> {
    if (payload.quantity === 0) {
      // Changing quantity to 0 is not allowed. Use the remove call instead. This is done to avoid accidental removal of item.
      // Calls with quantity 0 will just be ignored.
      return this.getById({ cart: payload.cart });
    }

    return this.applyActions(payload.cart, [
      {
        action: 'changeLineItemQuantity',
        lineItemId: payload.item.key,
        quantity: payload.quantity,
      },
      {
        action: 'recalculate',
      },
    ]);
  }

  public override async getActiveCartId(): Promise<CartIdentifier> {
    const client = await this.getClient();
    try {
      const carts = await client.activeCart.get().execute();

      return CommercetoolsCartIdentifierSchema.parse({
        key: carts.body.id,
        version: carts.body.version || 0,
      });
    } catch (e: any) {
      return CommercetoolsCartIdentifierSchema.parse({
        key: '',
        version: 0,
      });
    }
  }

  public override async deleteCart(
    payload: CartMutationDeleteCart
  ): Promise<T> {
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

    const activeCartId = await this.getActiveCartId();
    return this.getById({ cart: activeCartId });
  }

  public override async setShippingInfo(
    payload: CartMutationSetShippingInfo
  ): Promise<T> {
    const client = await this.getClient();
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
          country:
            payload.shippingAddress.countryCode ||
            this.context.taxJurisdiction.countryCode ||
            'US',
          firstName: payload.shippingAddress.firstName,
          lastName: payload.shippingAddress.lastName,
          city: payload.shippingAddress.city,
          postalCode: payload.shippingAddress.postalCode,
          streetName: payload.shippingAddress.streetAddress,
          streetNumber: payload.shippingAddress.streetNumber,
        },
      });
    }

    return this.applyActions(payload.cart, actions);
  }

  public override setBillingAddress(
    payload: CartMutationSetBillingAddress
  ): Promise<T> {
    return this.applyActions(payload.cart, [
      {
        action: 'setBillingAddress',
        address: {
          email: payload.notificationEmailAddress,
          mobile: payload.notificationPhoneNumber,
          country:
            payload.billingAddress.countryCode ||
            this.context.taxJurisdiction.countryCode ||
            'US',
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
        country:
          payload.billingAddress.countryCode ||
          this.context.taxJurisdiction.countryCode ||
          'US',
      },
    ]);
  }

  public override applyCouponCode(
    payload: CartMutationApplyCoupon
  ): Promise<T> {
    return this.applyActions(payload.cart, [
      {
        action: 'addDiscountCode',
        code: payload.couponCode,
      },
      {
        action: 'recalculate',
      },
    ]);
  }

  public override removeCouponCode(
    payload: CartMutationRemoveCoupon
  ): Promise<T> {
    return this.applyActions(payload.cart, [
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
  }

  public override async checkout(
    payload: CartMutationCheckout
  ): Promise<OrderIdentifier> {
    // In Commercetools, checkout is done by creating an order from the cart.

    const client = await this.getClient();
    const ctId = payload.cart as CommercetoolsCartIdentifier;

    const orderResponse = await client.orders
      .post({
        body: {
          version: ctId.version,
          id: ctId.key,
        },
      })
      .execute();
    return CommercetoolsOrderIdentifierSchema.parse({
      key: orderResponse.body.id,
      version: orderResponse.body.version || 0,
    });
  }

  public override async changeCurrency(
    payload: CartMutationChangeCurrency
  ): Promise<T> {
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

    return response;
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
  ): Promise<T> {
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
      orders: clientWithProject.me().orders()
    };
  }

  protected override parseSingle(remote: CTCart): T {
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
      item.variant.sku = remoteItem.variant.sku || '';
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
        key: this.generateCacheKeySingle(result.identifier),
      },
      placeholder: false,
    };

    return this.assert(result);
  }
}
