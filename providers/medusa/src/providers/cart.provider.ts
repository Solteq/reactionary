import type {
  Cache,
  Cart,
  CartIdentifier,
  CartMutationApplyCoupon,
  CartMutationChangeCurrency,
  CartMutationDeleteCart,
  CartMutationItemAdd,
  CartMutationItemQuantityChange,
  CartMutationItemRemove,
  CartMutationRemoveCoupon,
  CartQueryById,
  CostBreakDown,
  Currency,
  Meta,
  ProductVariantIdentifier,
  RequestContext,
  CartItem,
} from '@reactionary/core';
import {
  CartItemSchema,
  CartProvider,
  CartSchema,
  CartIdentifierSchema,
  CartQueryByIdSchema,
  CartMutationItemAddSchema,
  CartMutationItemRemoveSchema,
  CartMutationItemQuantityChangeSchema,
  CartMutationDeleteCartSchema,
  CartMutationApplyCouponSchema,
  CartMutationRemoveCouponSchema,
  CartMutationChangeCurrencySchema,
  ProductVariantIdentifierSchema,
  Reactionary,
} from '@reactionary/core';

import createDebug from 'debug';
import type { z } from 'zod';
import type { MedusaClient } from '../core/client.js';
import { MedusaAdminClient } from '../core/client.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import type {
  MedusaCartIdentifier,
  MedusaSession
} from '../schema/medusa.schema.js';
import {
  MedusaCartIdentifierSchema,
  MedusaOrderIdentifierSchema,
  MedusaSessionSchema,
} from '../schema/medusa.schema.js';
import type MedusaTypes = require('@medusajs/types');
import type StoreCartPromotion = require('@medusajs/types');

const debug = createDebug('reactionary:medusa:cart');

export class MedusaCartProvider extends CartProvider {
  protected config: MedusaConfiguration;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public client: MedusaClient
  ) {
    super(cache, context);
    this.config = config;
  }

  @Reactionary({
    inputSchema: CartQueryByIdSchema,
    outputSchema: CartSchema,
  })
  public override async getById(
    payload: CartQueryById
  ): Promise<Cart> {
    try {
      const client = await this.getClient();
      const medusaId = payload.cart as MedusaCartIdentifier;

      if (debug.enabled) {
        debug('Fetching cart by ID:', medusaId.key);
      }

      const cartResponse = await client.store.cart.retrieve(medusaId.key);

      if (debug.enabled) {
        debug('Received cart response:', cartResponse);
      }

      if (cartResponse.cart) {
        return this.parseSingle(cartResponse.cart);
      }

      return this.createEmptyCart();
    } catch (error) {
      debug('Failed to get cart by ID:', error);
      return this.createEmptyCart();
    }
  }

  @Reactionary({
    inputSchema: CartMutationItemAddSchema,
    outputSchema: CartSchema,
  })
  public override async add(
    payload: CartMutationItemAdd
  ): Promise<Cart> {
    try {
      const client = await this.getClient();

      let cartIdentifier = payload.cart;
      if (!cartIdentifier.key) {
        cartIdentifier = await this.createCart();
      }

      const medusaId = cartIdentifier as MedusaCartIdentifier;

      if (debug.enabled) {
        debug('Adding item to cart ID:', medusaId.key, 'SKU:', payload.variant.sku, 'Quantity:', payload.quantity);
      }

      // TODO: Convert from global SKU identifier, to something medusa understands.....

      // the SKU identifier is supposed to be a globally understood identifier,

      // but medusa only accepts variant IDs , so we have to resolve it somehow...
      const variantId = await this.client.resolveVariantId(payload.variant.sku);
      const cc = this.context.languageContext;

      const response = await client.store.cart.createLineItem(medusaId.key, {
        variant_id: variantId,
        quantity: payload.quantity,
      }, {
        fields: '+items.*'
      });

      if (debug.enabled) {
        debug('Received add item response:', response);
      }

      if (response.cart) {
        return this.parseSingle(response.cart);
      }

      throw new Error('Failed to add item to cart');
    } catch (error) {
      debug('Failed to add item to cart:', error);
      throw new Error(`Failed to add item to cart: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  @Reactionary({
    inputSchema: CartMutationItemRemoveSchema,
    outputSchema: CartSchema,
  })
  public override async remove(
    payload: CartMutationItemRemove
  ): Promise<Cart> {
    try {
      const client = await this.getClient();
      const medusaId = payload.cart as MedusaCartIdentifier;

      const response = await client.store.cart.deleteLineItem(
        medusaId.key,
        payload.item.key,
        {
          fields: '+items.*'
        }
      );

      if (response.parent) {
        return this.parseSingle(response.parent);
      }

      throw new Error('Failed to remove item from cart');
    } catch (error) {
      debug('Failed to remove item from cart:', error);
      throw new Error(`Failed to remove item from cart: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  @Reactionary({
    inputSchema: CartMutationItemQuantityChangeSchema,
    outputSchema: CartSchema,
  })
  public override async changeQuantity(
    payload: CartMutationItemQuantityChange
  ): Promise<Cart> {
    if (payload.quantity < 1) {
      throw new Error('Changing quantity to 0 is not allowed. Use the remove call instead.');
      // Changing quantity to 0 is not allowed. Use the remove call instead.
      // return this.getById({ cart: payload.cart }, reqCtx);
    }

    try {
      const client = await this.getClient();
      const medusaId = payload.cart as MedusaCartIdentifier;

      const response = await client.store.cart.updateLineItem(
        medusaId.key,
        payload.item.key,
        {
          quantity: payload.quantity,
        },
        {
          fields: '+items.*'
        }

      );

      if (response.cart) {
        return this.parseSingle(response.cart);
      }

      throw new Error('Failed to change item quantity');
    } catch (error) {
      debug('Failed to change item quantity:', error);
      throw new Error(`Failed to change item quantity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  @Reactionary({
    outputSchema: CartIdentifierSchema,
  })
  public override async getActiveCartId(
  ): Promise<CartIdentifier> {
    try {
      const client = await this.getClient();
      const sessionData = this.client.getSessionData();
      // Check if customer has an active cart in session storage or create new one
      const activeCartId = sessionData.activeCartId;

      if (activeCartId) {
        try {
          await client.store.cart.retrieve(activeCartId);
          return MedusaCartIdentifierSchema.parse({
            key: activeCartId,
            region_id: (await this.client.getActiveRegion()).id
          });
        } catch {
          // Cart doesn't exist, create new one
        }
      }

      // For guest users or if no active cart exists, return empty identifier
      return MedusaCartIdentifierSchema.parse({
        key: '',
        region_id: (await this.client.getActiveRegion()).id
      });
    } catch (error) {
      debug('Failed to get active cart ID:', error);
      return MedusaCartIdentifierSchema.parse({
        key: '',
        region_id: (await this.client.getActiveRegion()).id
      });
    }
  }

  @Reactionary({
    inputSchema: CartMutationDeleteCartSchema,
    outputSchema: CartSchema,
  })
  public override async deleteCart(
    payload: CartMutationDeleteCart
  ): Promise<Cart> {
    try {
      const client = await this.getClient();
      const medusaId = payload.cart as MedusaCartIdentifier;

      if (medusaId.key) {
        const sessionData = this.client.getSessionData();
        if (sessionData.activeCartId) {
          delete sessionData.activeCartId;
          this.client.setSessionData(
            {
              activeCartId: undefined
            }
          );
        }
      }
      // then delete it. But there is not really a deleteCart method, so we just orphan it.
//      await client.store.cart.deleteCart(medusaId.key);

      // lets delete all items
      const cartResponse = await client.store.cart.retrieve(medusaId.key);
      if (cartResponse.cart) {
        for (const item of cartResponse.cart.items || []) {
          await client.store.cart.deleteLineItem(
            medusaId.key,
            item.id,
          );
        }
      }

      return this.createEmptyCart();
    } catch (error) {
      debug('Failed to delete cart:', error);
      return this.createEmptyCart();
    }
  }


  @Reactionary({
    inputSchema: CartMutationApplyCouponSchema,
    outputSchema: CartSchema,
  })
  public override async applyCouponCode(
    payload: CartMutationApplyCoupon
  ): Promise<Cart> {
    try {
      const client = await this.getClient();
      const medusaId = payload.cart as MedusaCartIdentifier;

      const response = await client.store.cart.update(medusaId.key, {
        promo_codes: [ payload.couponCode ],
      }, {
        fields: '+items.*'
      });

      if (response.cart) {
        return this.parseSingle(response.cart);
      }

      throw new Error('Failed to apply coupon code');
    } catch (error) {
      debug('Failed to apply coupon code:', error);
      throw new Error(`Failed to apply coupon code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  @Reactionary({
    inputSchema: CartMutationRemoveCouponSchema,
    outputSchema: CartSchema,
  })
  public override async removeCouponCode(
    payload: CartMutationRemoveCoupon
  ): Promise<Cart> {
    try {
      const client = await this.getClient();
      const medusaId = payload.cart as MedusaCartIdentifier;

      // Get current cart to find the discount to remove
      const cartResponse = await client.store.cart.retrieve(medusaId.key);

      if (cartResponse.cart?.promotions) {
        const manualDiscounts = cartResponse.cart.promotions.filter(x => !x.is_automatic && x.code);

        const remainingCodes = (manualDiscounts.filter(x => x.code !== payload.couponCode).map((promotion: MedusaTypes.StoreCartPromotion) => ( promotion.code )) || []) as string[];
        const response = await client.store.cart.update(medusaId.key, {
          promo_codes: (remainingCodes || []),
        });

        if (response.cart) {
          return this.parseSingle(response.cart);
        }
      }

      throw new Error('Failed to remove coupon code');
    } catch (error) {
      debug('Failed to remove coupon code:', error);
      throw new Error(`Failed to remove coupon code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  @Reactionary({
    inputSchema: CartMutationChangeCurrencySchema,
    outputSchema: CartSchema,
  })
  public override async changeCurrency(
    payload: CartMutationChangeCurrency
  ): Promise<Cart> {
    try {
      const client = await this.getClient();


      // Get current cart
      const currentCartResponse = await client.store.cart.retrieve(payload.cart.key);
      client.store.cart.update(payload.cart.key, {
        region_id: (await this.client.getActiveRegion()).id,
      },
      {
        fields: '+items.*'
      }
  );
      if (!currentCartResponse.cart) {
        throw new Error('Cart not found');
      }

      // Get the new cart
      const newCartResponse = await client.store.cart.retrieve(payload.cart.key);

      if (newCartResponse.cart) {
        // Update session to use new cart
        this.client.setSessionData({
          activeCartId: newCartResponse.cart.id
        });

        return this.parseSingle(newCartResponse.cart);
      }

      throw new Error('Failed to change currency');
    } catch (error) {
      debug('Failed to change currency:', error);
      throw new Error(`Failed to change currency: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected async createCart(
    currency?: string
  ): Promise<CartIdentifier> {
    try {
      const client = await this.getClient();

      const response = await client.store.cart.create({
        currency_code: (currency || this.context.languageContext.currencyCode || '').toLowerCase(),
      },
      {
        fields: '+items.*'
      }
    )

      if (response.cart) {
        const cartIdentifier = MedusaCartIdentifierSchema.parse({
          key: response.cart.id,
          region_id: response.cart.region_id,
        });

        // Store cart ID in session
        this.client.setSessionData(
          {
            activeCartId: cartIdentifier.key
          }
        );


        return cartIdentifier;
      }

      throw new Error('Failed to create cart');
    } catch (error) {
      debug('Failed to create cart:', error);
      throw new Error(`Failed to create cart: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected async getClient() {
     return this.client.getClient();
  }

  protected parseSingle(remote: MedusaTypes.StoreCart): Cart {
    const identifier = MedusaCartIdentifierSchema.parse({
      key: remote.id,
      region_id: remote.region_id,
    });

    const name = '' + (remote.metadata?.['name'] || '');
    const description = '' + (remote.metadata?.['description'] || '');

    // Calculate totals
    const grandTotal = remote.total || 0;
    const shippingTotal = remote.shipping_total || 0;
    const taxTotal = remote.tax_total || 0;
    const discountTotal = remote.discount_total || 0;
    const subtotal = remote.subtotal || 0;
    const currency = (remote.currency_code || 'EUR').toUpperCase() as Currency;

    const price = {
      totalTax: {
        value: taxTotal,
        currency,
      },
      totalDiscount: {
        value: discountTotal,
        currency,
      },
      totalSurcharge: {
        value: 0,
        currency,
      },
      totalShipping: {
        value: shippingTotal,
        currency,
      },
      totalProductPrice: {
        value: subtotal ,
        currency,
      },
      grandTotal: {
        value: grandTotal,
        currency,
      },
    } satisfies CostBreakDown;

    // Parse cart items
    const items = new Array<CartItem>();
    for (const remoteItem of remote.items || []) {
      const item = CartItemSchema.parse({});

      item.identifier.key = remoteItem.id;
      item.product.key = remoteItem.product_id || '';
      item.variant = ProductVariantIdentifierSchema.parse({
        sku: remoteItem.variant_sku || '',
      } satisfies ProductVariantIdentifier);
      item.quantity = remoteItem.quantity || 1;

      const unitPrice = remoteItem.unit_price || 0;
      const totalPrice = unitPrice * item.quantity || 0;
      const discountTotal = remoteItem.discount_total || 0;

      item.price = {
        unitPrice: {
          value: unitPrice ,
          currency,
        },
        unitDiscount: {
          value: discountTotal / remoteItem.quantity ,
          currency,
        },
        totalPrice: {
          value: totalPrice ,
          currency,
        },
        totalDiscount: {
          value: discountTotal ,
          currency,
        },
      };

      items.push(item);
    }

    const meta = {
      cache: {
        hit: false,
        key: this.generateCacheKeySingle(identifier),
      },
      placeholder: false,
    } satisfies Meta;

    const result = {
      identifier,
      name,
      description,
      price,
      items,
      meta,
      userId: {
        userId: '???'
      }
    } satisfies Cart;

    return result;
  }


}
