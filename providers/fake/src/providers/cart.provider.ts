import type {
  Cart,
  CartQueryById,
  CartMutationItemAdd,
  CartMutationItemRemove,
  CartMutationItemQuantityChange,
  RequestContext,
  Cache,
  CartIdentifier,
  CartMutationApplyCoupon,
  CartMutationChangeCurrency,
  CartMutationDeleteCart,
  CartMutationRemoveCoupon } from '@reactionary/core';
import {
  CartIdentifierSchema,
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
  Reactionary
} from '@reactionary/core';
import type z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { Faker, en, base } from '@faker-js/faker';

export class FakeCartProvider extends CartProvider {
  protected config: FakeConfiguration;
  private carts: Map<string, Cart> = new Map();
  private generator: Faker;


  constructor(config: FakeConfiguration, cache: Cache, context: RequestContext) {
    super(cache, context);
    this.generator = new Faker({
      locale: [en, base],
      seed: config.seeds.product
    });
    this.config = config;
  }

  @Reactionary({
    inputSchema: CartQueryByIdSchema,
    outputSchema: CartSchema
  })
  public override async getById(
    payload: CartQueryById
  ): Promise<Cart> {
    const cartId = payload.cart.key;

    if (payload.cart.key === '') {
      return this.createEmptyCart();
    }

    if (!this.carts.has(cartId)) {
      const cart = this.createEmptyCart();
      cart.identifier.key = cartId;

      this.carts.set(cartId, cart);
    }

    const cart = this.carts.get(cartId);
    if (!cart) {
      throw new Error(`Cart with id ${cartId} not found`);
    }
    return cart;
  }

  @Reactionary({
    inputSchema: CartMutationItemAddSchema,
    outputSchema: CartSchema
  })
  public override async add(
    payload: CartMutationItemAdd
  ): Promise<Cart> {

    const cartId = payload.cart.key || `cart-${this.generator.string.uuid()}`;
    const cart = await this.getById({ cart: { key: cartId } });
    if (cart.meta.placeholder) {
      cart.identifier.key = cartId;
      cart.meta.placeholder = false;
      this.carts.set(cartId, cart);
    }
    const existingItemIndex = cart.items.findIndex(
      item => item.variant.sku === payload.variant.sku
    );

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += payload.quantity;
    } else {
      const price = this.generator.number.int({ min: 100, max: 100000 }) / 100;

      cart.items.push({
        identifier: { key: `item-${Date.now()}` },
        variant:  payload.variant,
        quantity: payload.quantity,
        price: {
          unitPrice: {
            value: price,
            currency: this.context.languageContext.currencyCode,
          },
          totalPrice: {
            value: 0, // Will be calculated below
            currency: this.context.languageContext.currencyCode,
          },
          totalDiscount: {
            value: 0,
            currency: this.context.languageContext.currencyCode,
          },
          unitDiscount: {
            value: 0,
            currency: this.context.languageContext.currencyCode,
          },
        },
        product: {
          key: `product-for-${payload.variant.sku}`,
        },
      });
    }

    this.recalculateCart(cart);

    return cart;
  }

  @Reactionary({
    inputSchema: CartMutationItemRemoveSchema,
    outputSchema: CartSchema
  })
  public override async remove(
    payload: CartMutationItemRemove
  ): Promise<Cart> {
    const cartId = payload.cart.key || `cart-${this.generator.string.uuid()}`;
    const cart = await this.getById({ cart: { key: cartId } });

    cart.items = cart.items.filter(
      item => item.identifier.key !== payload.item.key
    );
    this.recalculateCart(cart);
    return cart;
  }

  @Reactionary({
    inputSchema: CartMutationItemQuantityChangeSchema,
    outputSchema: CartSchema
  })
  public override async changeQuantity(
    payload: CartMutationItemQuantityChange
  ): Promise<Cart> {
    const cartId = payload.cart.key || `cart-${this.generator.string.uuid()}`;
    const cart = await this.getById({ cart: { key: cartId } });

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
    return cart;
  }

  @Reactionary({
    outputSchema: CartIdentifierSchema
  })
  public override getActiveCartId(): Promise<CartIdentifier> {
    throw new Error('Method not implemented.');
  }

  @Reactionary({
    inputSchema: CartMutationDeleteCartSchema,
    outputSchema: CartSchema
  })
  public override deleteCart(payload: CartMutationDeleteCart): Promise<Cart> {
    throw new Error('Method not implemented.');
  }

  @Reactionary({
    inputSchema: CartMutationApplyCouponSchema,
    outputSchema: CartSchema
  })
  public override applyCouponCode(payload: CartMutationApplyCoupon): Promise<Cart> {
    throw new Error('Method not implemented.');
  }

  @Reactionary({
    inputSchema: CartMutationRemoveCouponSchema,
    outputSchema: CartSchema
  })
  public override removeCouponCode(payload: CartMutationRemoveCoupon): Promise<Cart> {
    throw new Error('Method not implemented.');
  }

  @Reactionary({
    inputSchema: CartMutationChangeCurrencySchema,
    outputSchema: CartSchema
  })
  public override changeCurrency(payload: CartMutationChangeCurrency): Promise<Cart> {
    throw new Error('Method not implemented.');
  }

  protected recalculateCart(cart: Cart) {
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
