import type {
  Cart,
  CartFactory,
  CartFactoryCartOutput,
  CartFactoryIdentifierOutput,
  CartFactoryWithOutput,
  CartQueryById,
  CartQueryList,
  CartPaginatedSearchResult,
  CartMutationItemAdd,
  CartMutationItemRemove,
  CartMutationItemQuantityChange,
  CartMutationCreateCart,
  CartMutationRenameCart,
  RequestContext,
  Cache,
  CartMutationApplyCoupon,
  CartMutationChangeCurrency,
  CartMutationDeleteCart,
  CartMutationRemoveCoupon,
  Result,
  NotFoundError,
  CartIdentifier,
} from '@reactionary/core';
import {
  CartIdentifierSchema,
  CartMutationApplyCouponSchema,
  CartMutationChangeCurrencySchema,
  CartMutationDeleteCartSchema,
  CartMutationItemAddSchema,
  CartMutationItemQuantityChangeSchema,
  CartMutationItemRemoveSchema,
  CartMutationRemoveCouponSchema,
  CartMutationRenameCartSchema,
  CartCapability,
  CartQueryByIdSchema,
  CartSchema,
  Reactionary,
  error,
  success,
  unwrapValue,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { Faker, en, base } from '@faker-js/faker';
import type { FakeCartFactory } from '../factories/cart/cart.factory.js';

export class FakeCartCapability<
  TFactory extends CartFactory = FakeCartFactory,
> extends CartCapability<
  CartFactoryCartOutput<TFactory>,
  CartFactoryIdentifierOutput<TFactory>
> {
  protected config: FakeConfiguration;
  protected factory: CartFactoryWithOutput<TFactory>;
  private carts: Map<string, Cart> = new Map();
  private generator: Faker;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: CartFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.generator = new Faker({
      locale: [en, base],
      seed: config.seeds.product,
    });
    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: CartQueryByIdSchema,
    outputSchema: CartSchema,
  })
  public override async getById(
    payload: CartQueryById
  ): Promise<Result<CartFactoryCartOutput<TFactory>, NotFoundError>> {
    const cartId = payload.cart.key;

    if (payload.cart.key === '') {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: cartId,
      });
    }

    if (!this.carts.has(cartId)) {

      return error<NotFoundError>({
        type: 'NotFound',
        identifier: cartId,
      });
    }

    const cart = this.carts.get(cartId);
    if (!cart) {
      throw new Error(`Cart with id ${cartId} not found`);
    }
    return success(this.factory.parseCart(this.context, cart));
  }

  @Reactionary({
    inputSchema: CartMutationItemAddSchema,
    outputSchema: CartSchema,
  })
  public override async add(payload: CartMutationItemAdd): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const cartId = payload?.cart?.key || `cart-${this.generator.string.uuid()}`;
    const cart = unwrapValue(await this.getById({ cart: { key: cartId } }));

    if (cart.identifier.key === '') {
      cart.identifier.key = cartId;
      this.carts.set(cartId, cart);
    }
    const existingItemIndex = cart.items.findIndex(
      (item) => item.variant.sku === payload.variant.sku
    );

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += payload.quantity;
    } else {
      const price = this.generator.number.int({ min: 100, max: 100000 }) / 100;

      cart.items.push({
        identifier: { key: `item-${Date.now()}` },
        variant: payload.variant,
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

    return success(this.factory.parseCart(this.context, cart));
  }

  @Reactionary({
    inputSchema: CartMutationItemRemoveSchema,
    outputSchema: CartSchema,
  })
  public override async remove(payload: CartMutationItemRemove): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const cartId = payload.cart.key || `cart-${this.generator.string.uuid()}`;
    const cart = unwrapValue(await this.getById({ cart: { key: cartId } }));

    cart.items = cart.items.filter(
      (item) => item.identifier.key !== payload.item.key
    );
    this.recalculateCart(cart);

    return success(this.factory.parseCart(this.context, cart));
  }

  @Reactionary({
    inputSchema: CartMutationItemQuantityChangeSchema,
    outputSchema: CartSchema,
  })
  public override async changeQuantity(
    payload: CartMutationItemQuantityChange
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const cartId = payload.cart.key || `cart-${this.generator.string.uuid()}`;
    const cart = unwrapValue(await this.getById({ cart: { key: cartId } }));

    const item = cart.items.find(
      (item) => item.identifier.key === payload.item.key
    );
    if (payload.quantity < 1) {
      return success(this.factory.parseCart(this.context, cart));
    }
    if (item) {
      item.quantity = payload.quantity;
    }
    this.recalculateCart(cart);
    return success(this.factory.parseCart(this.context, cart));
  }

  public override async listCarts(
    _payload: CartQueryList,
  ): Promise<Result<CartPaginatedSearchResult>> {
    return success(this.factory.parseCartPaginatedSearchResult(this.context, {
      pageNumber: 0,
      pageSize: 0,
      totalCount: 0,
      totalPages: 0,
      items: [],
      identifier: _payload.search
    } satisfies CartPaginatedSearchResult, _payload));
  }

  public override async createCart(
    _payload: CartMutationCreateCart,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const emptyCart = this.createEmptyCart();
    emptyCart.identifier.key = `cart-${this.generator.string.uuid()}`;
    this.carts.set(emptyCart.identifier.key, emptyCart);
    return success(this.factory.parseCart(this.context, emptyCart));
  }

  @Reactionary({
    inputSchema: CartMutationRenameCartSchema,
    outputSchema: CartSchema,
  })
  public override async renameCart(
    _payload: CartMutationRenameCart,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const cart = this.carts.get(_payload.cart.key);
    if (!cart) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: _payload.cart.key,
      });
    }
    cart.name = _payload.newName;
    return success(this.factory.parseCart(this.context, cart));
  }

  @Reactionary({
    outputSchema: CartIdentifierSchema,
  })
  public override async getActiveCartId(): Promise<
    Result<CartFactoryIdentifierOutput<TFactory>, NotFoundError>
  > {
    if (this.carts.size > 0 ) {
      const cartId = { key: this.carts.values().next().value!.identifier.key } satisfies CartIdentifier;
      return success(this.factory.parseCartIdentifier(this.context, cartId));
    } else {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: 'activeCart',
      });
    }
  }

  @Reactionary({
    inputSchema: CartMutationDeleteCartSchema,
    outputSchema: CartSchema,
  })
  public override async deleteCart(payload: CartMutationDeleteCart): Promise<Result<void>> {
    const cartId = payload.cart.key;
    if (this.carts.has(cartId)) {
      this.carts.delete(cartId);
    }
    return success(void 0);
  }

  @Reactionary({
    inputSchema: CartMutationApplyCouponSchema,
    outputSchema: CartSchema,
  })
  public override async  applyCouponCode(
    payload: CartMutationApplyCoupon
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const cart = this.carts.get(payload.cart.key);
    if (!cart) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.cart.key,
      });
    }
    cart.appliedPromotions.push({
      code: payload.couponCode,
      isCouponCode: true,
      name: `Promotion for ${payload.couponCode}`,
      description: `Description for promotion with code ${payload.couponCode}`,
    });
    cart.price.totalDiscount.value += 10; // For simplicity, every coupon gives a $10 discount
    cart.price.grandTotal.value -= 10;
    return success(this.factory.parseCart(this.context, cart));
  }

  @Reactionary({
    inputSchema: CartMutationRemoveCouponSchema,
    outputSchema: CartSchema,
  })
  public override async removeCouponCode(
    payload: CartMutationRemoveCoupon
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const cart = this.carts.get(payload.cart.key);
    if (!cart) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.cart.key,
      });
    }
    const promoIndex = cart.appliedPromotions.findIndex(
      (promo) => promo.code === payload.couponCode
    );
    if (promoIndex >= 0) {
      cart.appliedPromotions.splice(promoIndex, 1);
      cart.price.totalDiscount.value -= 10; // For simplicity, every coupon gives a $10 discount
      cart.price.grandTotal.value += 10;
    }
    return success(this.factory.parseCart(this.context, cart));
  }

  @Reactionary({
    inputSchema: CartMutationChangeCurrencySchema,
    outputSchema: CartSchema,
  })
  public override async changeCurrency(
    payload: CartMutationChangeCurrency
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const cart = this.carts.get(payload.cart.key);
    if (!cart) {
      return Promise.resolve(
        error<NotFoundError>({
          type: 'NotFound',
          identifier: payload.cart.key,
        })
      );
    }
    cart.price.grandTotal.currency = payload.newCurrency;
    cart.price.totalDiscount.currency = payload.newCurrency;
    cart.price.totalProductPrice.currency = payload.newCurrency;
    cart.price.totalShipping.currency = payload.newCurrency;
    cart.price.totalSurcharge.currency = payload.newCurrency;
    cart.price.totalTax.currency = payload.newCurrency;
    cart.items.forEach((item) => {
      item.price.unitPrice.currency = payload.newCurrency;
      item.price.totalPrice.currency = payload.newCurrency;
      item.price.unitDiscount.currency = payload.newCurrency;
      item.price.totalDiscount.currency = payload.newCurrency;
    });
    return success(this.factory.parseCart(this.context, cart));
  }

  protected recalculateCart(cart: Cart) {
    cart.items.forEach((item) => {
      item.price.totalPrice.value = item.price.unitPrice.value * item.quantity;
    });

    cart.price.totalProductPrice = {
      value: cart.items.reduce(
        (sum, item) => sum + item.price.totalPrice.value,
        0
      ),
      currency: cart.items[0]?.price.unitPrice.currency || 'USD',
    };

    cart.price.grandTotal = {
      value: cart.items.reduce(
        (sum, item) => sum + item.price.totalPrice.value,
        0
      ),
      currency: cart.items[0]?.price.unitPrice.currency || 'USD',
    };

    // for each promocode applied, we give a $10 discount for simplicity
    cart.price.totalDiscount = {
      value: cart.appliedPromotions.length * 10,
      currency: cart.price.grandTotal.currency,
    };

    cart.price.grandTotal.value -= cart.price.totalDiscount.value;
  }

  protected createEmptyCart(): Cart {
    const cart = {
      identifier: { key: '' },
      description: '',
      items: [],
      name: '',
      price: {
        grandTotal: {
          value: 0,
          currency: 'XXX',
        },
        totalDiscount: {
          value: 0,
          currency: 'XXX',
        },
        totalProductPrice: {
          value: 0,
          currency: 'XXX',
        },
        totalShipping: {
          value: 0,
          currency: 'XXX',
        },
        totalSurcharge: {
          value: 0,
          currency: 'XXX',
        },
        totalTax: {
          value: 0,
          currency: 'XXX',
        },
      },
      appliedPromotions: [],
      user: {
        userId: '',
      },
    } satisfies Cart;

    return cart;
  }
}
