import {
  Cart,
  CartProvider,
  CartQueryById,
  CartMutationItemAdd,
  CartMutationItemRemove,
  CartMutationItemQuantityChange,
  Session,
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
    _session: Session
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
    session: Session
  ): Promise<T> {

    const cartId = payload.cart.key || `cart-${this.generator.string.uuid()}`;
    const cart = await this.getById({ cart: { key: cartId } }, session);

    const existingItemIndex = cart.items.findIndex(
      item => item.sku.key === payload.sku.key
    );

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += payload.quantity;
    } else {
      const price = this.generator.number.int({ min: 100, max: 100000 }) / 100;

      cart.items.push({
        identifier: { key: `item-${Date.now()}` },
        sku: payload.sku,
        quantity: payload.quantity,
        price: {
          unitPrice: {
            value: price,
            currency: session.languageContext.currencyCode,
          },
          totalPrice: {
            value: 0, // Will be calculated below
            currency: session.languageContext.currencyCode,
          },
          totalDiscount: {
            value: 0,
            currency: session.languageContext.currencyCode,
          },
          unitDiscount: {
            value: 0,
            currency: session.languageContext.currencyCode,
          },
        },
        product: {
          key: `product-for-${payload.sku.key}`,
        }
      });
    }

    this.recalculateCart(cart);

    return this.assert(cart);
  }

  public override async remove(
    payload: CartMutationItemRemove,
    session: Session
  ): Promise<T> {
    const cartId = payload.cart.key || `cart-${this.generator.string.uuid()}`;
    const cart = await this.getById({ cart: { key: cartId } }, session);

    cart.items = cart.items.filter(
      item => item.identifier.key !== payload.item.key
    );
    this.recalculateCart(cart);
    return this.assert(cart);
  }

  public override async changeQuantity(
    payload: CartMutationItemQuantityChange,
    session: Session
  ): Promise<T> {
    const cartId = payload.cart.key || `cart-${this.generator.string.uuid()}`;
    const cart = await this.getById({ cart: { key: cartId } }, session);

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


  public override getActiveCartId(session: Session): Promise<CartIdentifier> {
    throw new Error('Method not implemented.');
  }
  public override deleteCart(payload: CartMutationDeleteCart, session: Session): Promise<T> {
    throw new Error('Method not implemented.');
  }
  public override setShippingInfo(payload: CartMutationSetShippingInfo, session: Session): Promise<T> {
    throw new Error('Method not implemented.');
  }
  public override setBillingAddress(payload: CartMutationSetBillingAddress, session: Session): Promise<T> {
    throw new Error('Method not implemented.');
  }
  public override applyCouponCode(payload: CartMutationApplyCoupon, session: Session): Promise<T> {
    throw new Error('Method not implemented.');
  }
  public override removeCouponCode(payload: CartMutationRemoveCoupon, session: Session): Promise<T> {
    throw new Error('Method not implemented.');
  }
  public override checkout(payload: CartMutationCheckout, session: Session): Promise<OrderIdentifier> {
    throw new Error('Method not implemented.');
  }
  public override changeCurrency(payload: CartMutationChangeCurrency, session: Session): Promise<T> {
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
