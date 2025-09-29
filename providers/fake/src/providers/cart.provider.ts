import {
  Cart,
  CartProvider,
  CartQueryById,
  CartMutationItemAdd,
  CartMutationItemRemove,
  CartMutationItemQuantityChange,
  Session, RequestContext,
  Cache,
  CartIdentifier,
  CartMutationApplyCoupon,
  CartMutationChangeCurrency,
  CartMutationCheckout,
  CartMutationDeleteCart,
  CartMutationRemoveCoupon,
  CartMutationSetBillingAddress,
  CartMutationSetShippingInfo,
  OrderIdentifier,
} from '@reactionary/core';
import z from 'zod';
import { FakeConfiguration } from '../schema/configuration.schema';
import { Faker, en, base } from '@faker-js/faker';

export class FakeCartProvider<
  T extends Cart = Cart
> extends CartProvider<T> {
  protected config: FakeConfiguration;
  private carts: Map<string, T> = new Map();
  private generator: Faker;


  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);
    this.generator = new Faker({
      locale: [en, base],
      seed: config.seeds.product
    });
    this.config = config;
  }

  public override async getById(
    payload: CartQueryById,
    _reqCtx: RequestContext
  ): Promise<T> {
    const cartId = payload.cart.key;

    if (payload.cart.key === '') {
      const result = this.newModel();
      result.meta = {
        cache: { hit: false, key: 'empty' },
        placeholder: true
      };
      return this.assert(result);
    }

    if (!this.carts.has(cartId)) {
      const model = this.newModel();
      Object.assign(model, {
        identifier: { key: cartId },
        items: [],
        meta: {
          cache: {
            hit: false,
            key: cartId,
          },
          placeholder: false,
        },
      });
      this.carts.set(cartId, this.assert(model));
    }

    const cart = this.carts.get(cartId);
    if (!cart) {
      throw new Error(`Cart with id ${cartId} not found`);
    }
    return cart;
  }

  public override async add(
    payload: CartMutationItemAdd,
    reqCtx: RequestContext
  ): Promise<T> {

    const cartId = payload.cart.key || `cart-${this.generator.string.uuid()}`;
    const cart = await this.getById({ cart: { key: cartId } }, reqCtx);

    const existingItemIndex = cart.items.findIndex(
      item => item.sku.key === payload.sku.key
    );

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += payload.quantity;
    } else {
      const price = this.generator.number.int({ min: 100, max: 100000 }) / 100;

      cart.items.push({
        identifier: { key: `item-${Date.now()}` },
        sku:  payload.sku,
        quantity: payload.quantity,
        price: {
          unitPrice: {
            value: price,
            currency: reqCtx.languageContext.currencyCode,
          },
          totalPrice: {
            value: 0, // Will be calculated below
            currency: reqCtx.languageContext.currencyCode,
          },
          totalDiscount: {
            value: 0,
            currency: reqCtx.languageContext.currencyCode,
          },
          unitDiscount: {
            value: 0,
            currency: reqCtx.languageContext.currencyCode,
          },
        },
        product: {
          key: `product-for-${payload.sku.key}`,
        },


      });
    }

    this.recalculateCart(cart);

    return this.assert(cart);
  }

  public override async remove(
    payload: CartMutationItemRemove,
    reqCtx: RequestContext
  ): Promise<T> {
    const cartId = payload.cart.key || `cart-${this.generator.string.uuid()}`;
    const cart = await this.getById({ cart: { key: cartId } }, reqCtx);

    cart.items = cart.items.filter(
      item => item.identifier.key !== payload.item.key
    );
    this.recalculateCart(cart);
    return this.assert(cart);
  }

  public override async changeQuantity(
    payload: CartMutationItemQuantityChange,
    reqCtx: RequestContext
  ): Promise<T> {
    const cartId = payload.cart.key || `cart-${this.generator.string.uuid()}`;
    const cart = await this.getById({ cart: { key: cartId } }, reqCtx);

    const item = cart.items.find(
      item => item.identifier.key === payload.item.key
    );
    if (payload.quantity < 1) {
      return cart;
    }
    if (item) {
      item.quantity = payload.quantity;
    }
    this.recalculateCart(cart);
    return this.assert(cart);
  }


  public override getActiveCartId(reqCtx: RequestContext): Promise<CartIdentifier> {
    throw new Error('Method not implemented.');
  }
  public override deleteCart(payload: CartMutationDeleteCart, reqCtx: RequestContext): Promise<T> {
    throw new Error('Method not implemented.');
  }
  public override setShippingInfo(payload: CartMutationSetShippingInfo, reqCtx: RequestContext): Promise<T> {
    throw new Error('Method not implemented.');
  }
  public override setBillingAddress(payload: CartMutationSetBillingAddress, reqCtx: RequestContext): Promise<T> {
    throw new Error('Method not implemented.');
  }
  public override applyCouponCode(payload: CartMutationApplyCoupon, reqCtx: RequestContext): Promise<T> {
    throw new Error('Method not implemented.');
  }
  public override removeCouponCode(payload: CartMutationRemoveCoupon, reqCtx: RequestContext): Promise<T> {
    throw new Error('Method not implemented.');
  }
  public override checkout(payload: CartMutationCheckout, reqCtx: RequestContext): Promise<OrderIdentifier> {
    throw new Error('Method not implemented.');
  }
  public override changeCurrency(payload: CartMutationChangeCurrency, reqCtx: RequestContext): Promise<T> {
    throw new Error('Method not implemented.');
  }




  protected recalculateCart(cart: T) {
    cart.items.forEach(item => {
      item.price.totalPrice.value = item.price.unitPrice.value * item.quantity;
    });

    cart.price.totalProductPrice = {
      value: cart.items.reduce((sum, item) => sum + item.price.totalPrice.value, 0),
      currency: cart.items[0]?.price.unitPrice.currency || 'USD',
    }

    cart.price.grandTotal = {
      value: cart.items.reduce((sum, item) => sum + item.price.totalPrice.value, 0),
      currency: cart.items[0]?.price.unitPrice.currency || 'USD',
    };
  }



}
