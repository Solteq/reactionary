import {
  Cart,
  CartProvider,
  CartQueryById,
  CartMutationItemAdd,
  CartMutationItemRemove,
  CartMutationItemQuantityChange,
  Session,
} from '@reactionary/core';
import z from 'zod';
import { FakeConfiguration } from '../schema/configuration.schema';

export class FakeCartProvider<
  T extends Cart = Cart
> extends CartProvider<T> {
  protected config: FakeConfiguration;
  private carts: Map<string, T> = new Map();

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: any) {
    super(schema, cache);

    this.config = config;
  }

  public override async getById(
    payload: CartQueryById,
    session: Session
  ): Promise<T> {
    const cartId = payload.cart.key;
    
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
    
    return this.carts.get(cartId)!;
  }

  public override async add(
    payload: CartMutationItemAdd,
    session: Session
  ): Promise<T> {
    const cart = await this.getById({ cart: payload.cart }, session);
    
    const existingItemIndex = cart.items.findIndex(
      item => item.product.key === payload.product.key
    );
    
    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += payload.quantity;
    } else {
      cart.items.push({
        identifier: { key: `item-${Date.now()}` },
        product: payload.product,
        quantity: payload.quantity,
      });
    }
    
    return this.assert(cart);
  }

  public override async remove(
    payload: CartMutationItemRemove,
    session: Session
  ): Promise<T> {
    const cart = await this.getById({ cart: payload.cart }, session);
    
    cart.items = cart.items.filter(
      item => item.identifier.key !== payload.item.key
    );
    
    return this.assert(cart);
  }

  public override async changeQuantity(
    payload: CartMutationItemQuantityChange,
    session: Session
  ): Promise<T> {
    const cart = await this.getById({ cart: payload.cart }, session);
    
    const item = cart.items.find(
      item => item.identifier.key === payload.item.key
    );
    
    if (item) {
      item.quantity = payload.quantity;
    }
    
    return this.assert(cart);
  }
}