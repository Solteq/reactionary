import {
  Cart,
  CartItemSchema,
  CartProvider,
  Cache,
  Currency,
} from '@reactionary/core';
import type {
  CartMutationItemAdd,
  CartMutationItemQuantityChange,
  CartMutationItemRemove,
  CartQueryById,
  Session,
  CartIdentifier, CartMutationApplyCoupon,
  CartMutationCheckout,
  CartMutationDeleteCart,
  CartMutationRemoveCoupon, CartMutationSetBillingAddress,
  CartMutationSetShippingInfo,
  CartMutationChangeCurrency, OrderIdentifier
} from '@reactionary/core';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { z } from 'zod';
import { CommercetoolsClient } from '../core/client';
import {
  Cart as CTCart,
  MyCartUpdateAction,
} from '@commercetools/platform-sdk';
import { traced } from '@reactionary/otel';
import {
  CommercetoolsCartIdentifier,
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
    session: Session
  ): Promise<T> {
    try {
      const client = this.getClient(session);

      const ctId = payload.cart as CommercetoolsCartIdentifier;

      const remote = await client.withId({ ID: ctId.key }).get().execute();

      return this.parseSingle(remote.body, session);
    } catch (e) {
      return this.createEmptyCart();
    }
  }

  @traced()
  public override async add(
    payload: CartMutationItemAdd,
    session: Session
  ): Promise<T> {
    const client = this.getClient(session);

    let cartIdentifier = payload.cart;
    if (!cartIdentifier.key) {
      cartIdentifier = await this.createCart(session);
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
      session
    );
  }

  @traced()
  public override async remove(
    payload: CartMutationItemRemove,
    session: Session
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
      session
    );
  }

  @traced()
  public override async changeQuantity(
    payload: CartMutationItemQuantityChange,
    session: Session
  ): Promise<T> {
    if (payload.quantity === 0) {
      // Changing quantity to 0 is not allowed. Use the remove call instead. This is done to avoid accidental removal of item.
      // Calls with quantity 0 will just be ignored.
      return this.getById({ cart: payload.cart }, session);
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
      session
    );
  }

  @traced()
  public override async getActiveCartId(
    session: Session
  ): Promise<CartIdentifier> {
    const client = this.getClient(session);
    try {
      const carts = await client
        .withCustomerId({ customerId: session.id })
        .get({
          queryArgs: {
            limit: 1,
            sort: 'lastModifiedAt desc',
            where: 'cartState="Active"',
          },
        })
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
    session: Session
  ): Promise<T> {
    const client = this.getClient(session);
    if (payload.cart.key) {
      const ctId = payload.cart as CommercetoolsCartIdentifier;

      await client
        .withId({ ID: ctId.key })
        .delete({
          queryArgs: {
            version: ctId.version,
            dataErasure: false,
          },
        })
        .execute();
    }

    const activeCartId = await this.getActiveCartId(session);
    return this.getById({ cart: activeCartId }, session);
  }

  @traced()
  public override setShippingInfo(
    payload: CartMutationSetShippingInfo,
    session: Session
  ): Promise<T> {
    const client = this.getClient(session);
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
          country: payload.shippingAddress.countryCode || 'US',
          firstName: payload.shippingAddress.firstName,
          lastName: payload.shippingAddress.lastName,
          city: payload.shippingAddress.city,
          postalCode: payload.shippingAddress.postalCode,
          streetName: payload.shippingAddress.streetAddress,
          streetNumber: payload.shippingAddress.streetNumber,
        },
      });
    }

    return this.applyActions(payload.cart, actions, session);
  }

  @traced()
  public override setBillingAddress(
    payload: CartMutationSetBillingAddress,
    session: Session
  ): Promise<T> {
    return this.applyActions(
      payload.cart,
      [
        {
          action: 'setBillingAddress',
          address: {
            email: payload.notificationEmailAddress,
            mobile: payload.notificationPhoneNumber,
            country: payload.billingAddress.countryCode || 'US',
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
          country: payload.billingAddress.countryCode || 'US',
        },
      ],
      session
    );
  }

  @traced()
  public override applyCouponCode(
    payload: CartMutationApplyCoupon,
    session: Session
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
      session
    );
  }

  @traced()
  public override removeCouponCode(
    payload: CartMutationRemoveCoupon,
    session: Session
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
      session
    );
  }

  @traced()
  public override async checkout(
    payload: CartMutationCheckout,
    session: Session
  ): Promise<OrderIdentifier> {
    // In Commercetools, checkout is done by creating an order from the cart.

    const client = this.getOrderClient(session);
    const ctId = payload.cart as CommercetoolsCartIdentifier;

    const orderResponse = await client
      .post({
        body: {
          version: ctId.version,
          cart: {
            typeId: 'cart',
            id: ctId.key,
          },
        },
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
    session: Session
  ): Promise<T> {
    // ok, to do this we have to actually build a new cart, copy over all the items, and then delete the old cart.
    // because Commercetools does not support changing currency of an existing cart.

    // This is obviously not ideal, but it is what it is.

    const client = this.getClient(session);
    const currentCart = await client
      .withId({ ID: payload.cart.key })
      .get()
      .execute();
    const newCart = await client
      .post({
        body: {
          currency: payload.newCurrency,
          country: session.languageContext.countryCode || 'US',
          locale: session.languageContext.locale,
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
      session
    );

    // now delete the old cart.
    await client
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

  protected async createCart(session: Session): Promise<CartIdentifier> {
    const client = this.getClient(session);
    const response = await client
      .post({
        body: {
          currency: session.languageContext.currencyCode || 'USD',
          country: session.languageContext.countryCode || 'US',
          locale: session.languageContext.locale,
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
    session: Session
  ): Promise<T> {
    const client = this.getClient(session);
    const ctId = cart as CommercetoolsCartIdentifier;



        const response = await client
          .withId({ ID: ctId.key })
          .post({
            body: {
              version: ctId.version,
              actions,
            },
          })
          .execute();

          return this.parseSingle(response.body, session);

  }

  @traced()
  protected getClient(session: Session) {
    const token = session.identity.keyring.find(
      (x) => x.service === 'commercetools'
    )?.token;
    const client = new CommercetoolsClient(this.config).getClient(token);

    const cartClient = client
      .withProjectKey({ projectKey: this.config.projectKey })
      .carts();

    return cartClient;
  }

  protected getOrderClient(session: Session) {
    const token = session.identity.keyring.find(
      (x) => x.service === 'commercetools'
    )?.token;
    const client = new CommercetoolsClient(this.config).getClient(token);

    const orderClient = client
      .withProjectKey({ projectKey: this.config.projectKey })
      .orders();

    return orderClient;
  }

  @traced()
  protected getPaymentClient(session: Session) {
    const token = session.identity.keyring.find(
      (x) => x.service === 'commercetools'
    )?.token;
    const client = new CommercetoolsClient(this.config).getClient(token);

    const paymentClient = client
      .withProjectKey({ projectKey: this.config.projectKey })
      .payments();

    return paymentClient;
  }

  protected override parseSingle(remote: CTCart, session: Session): T {
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
        key: this.generateCacheKeySingle(result.identifier, session),
      },
      placeholder: false,
    };

    return this.assert(result);
  }
}
