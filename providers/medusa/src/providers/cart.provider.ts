import type {
  Cache,
  Cart,
  CartIdentifier,
  CartMutationApplyCoupon,
  CartMutationChangeCurrency,
  CartMutationCheckout,
  CartMutationDeleteCart,
  CartMutationItemAdd,
  CartMutationItemQuantityChange,
  CartMutationItemRemove,
  CartMutationRemoveCoupon,
  CartMutationSetBillingAddress,
  CartMutationSetShippingInfo,
  CartQueryById,
  Currency,
  OrderIdentifier,
  RequestContext
} from '@reactionary/core';
import {
  CartItemSchema,
  CartProvider
} from '@reactionary/core';

import createDebug from 'debug';
import type { z } from 'zod';
import { MedusaClient } from '../core/client.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import type {
  MedusaCartIdentifier,
  MedusaSession
} from '../schema/medusa.schema.js';
import {
  MedusaCartIdentifierSchema,
  MedusaOrderIdentifierSchema,
  MedusaSessionSchema,
  MedusaSKUIdentifierSchema,
} from '../schema/medusa.schema.js';
import type MedusaTypes = require('@medusajs/types');
import type StoreCartPromotion = require('@medusajs/types');

const debug = createDebug('reactionary:medusa:cart');

export class MedusaCartProvider<
  T extends Cart = Cart
> extends CartProvider<T> {
  protected config: MedusaConfiguration;

  constructor(
    config: MedusaConfiguration,
    schema: z.ZodType<T>,
    cache: Cache
  ) {
    super(schema, cache);
    this.config = config;
  }

  public override async getById(
    payload: CartQueryById,
    reqCtx: RequestContext
  ): Promise<T> {
    try {
      const client = await this.getClient(reqCtx);
      const medusaId = payload.cart as MedusaCartIdentifier;

      if (debug.enabled) {
        debug('Fetching cart by ID:', medusaId.key);
      }

      const cartResponse = await client.store.cart.retrieve(medusaId.key);

      if (debug.enabled) {
        debug('Received cart response:', cartResponse);
      }

      if (cartResponse.cart) {
        return this.parseSingle(cartResponse.cart, reqCtx);
      }

      return this.createEmptyCart();
    } catch (error) {
      debug('Failed to get cart by ID:', error);
      return this.createEmptyCart();
    }
  }

  public override async add(
    payload: CartMutationItemAdd,
    reqCtx: RequestContext
  ): Promise<T> {
    try {
      const client = await this.getClient(reqCtx);

      let cartIdentifier = payload.cart;
      if (!cartIdentifier.key) {
        cartIdentifier = await this.createCart(reqCtx);
      }

      const medusaId = cartIdentifier as MedusaCartIdentifier;

      if (debug.enabled) {
        debug('Adding item to cart ID:', medusaId.key, 'SKU:', payload.sku.key, 'Quantity:', payload.quantity);
      }

      const response = await client.store.cart.createLineItem(medusaId.key, {
        variant_id: payload.sku.key,
        quantity: payload.quantity,
      }, {
        fields: '+items.*'
      });

      if (debug.enabled) {
        debug('Received add item response:', response);
      }

      if (response.cart) {
        return this.parseSingle(response.cart, reqCtx);
      }

      throw new Error('Failed to add item to cart');
    } catch (error) {
      debug('Failed to add item to cart:', error);
      throw new Error(`Failed to add item to cart: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public override async remove(
    payload: CartMutationItemRemove,
    reqCtx: RequestContext
  ): Promise<T> {
    try {
      const client = await this.getClient(reqCtx);
      const medusaId = payload.cart as MedusaCartIdentifier;

      const response = await client.store.cart.deleteLineItem(
        medusaId.key,
        payload.item.key,
        {
          fields: '+items.*'
        }
      );

      if (response.parent) {
        return this.parseSingle(response.parent, reqCtx);
      }

      throw new Error('Failed to remove item from cart');
    } catch (error) {
      debug('Failed to remove item from cart:', error);
      throw new Error(`Failed to remove item from cart: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public override async changeQuantity(
    payload: CartMutationItemQuantityChange,
    reqCtx: RequestContext
  ): Promise<T> {
    if (payload.quantity < 1) {
      throw new Error('Changing quantity to 0 is not allowed. Use the remove call instead.');
      // Changing quantity to 0 is not allowed. Use the remove call instead.
      // return this.getById({ cart: payload.cart }, reqCtx);
    }

    try {
      const client = await this.getClient(reqCtx);
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
        return this.parseSingle(response.cart, reqCtx);
      }

      throw new Error('Failed to change item quantity');
    } catch (error) {
      debug('Failed to change item quantity:', error);
      throw new Error(`Failed to change item quantity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public override async getActiveCartId(
    reqCtx: RequestContext
  ): Promise<CartIdentifier> {
    try {
      const client = await this.getClient(reqCtx);
      const sessionData = this.getSessionData(reqCtx);
      // Check if customer has an active cart in session storage or create new one
      const activeCartId = sessionData.activeCartId;

      if (activeCartId) {
        try {
          await client.store.cart.retrieve(activeCartId);
          return MedusaCartIdentifierSchema.parse({
            key: activeCartId,
    //        region_id: this.currencyToRegion(reqCtx.languageContext.currencyCode, this.config) ||  this.config.defaultRegion,
          });
        } catch {
          // Cart doesn't exist, create new one
        }
      }

      // For guest users or if no active cart exists, return empty identifier
      return MedusaCartIdentifierSchema.parse({
        key: '',
  //      region_id: this.currencyToRegion(reqCtx.languageContext.currencyCode, this.config) ||  this.config.defaultRegion,
      });
    } catch (error) {
      debug('Failed to get active cart ID:', error);
      return MedusaCartIdentifierSchema.parse({
        key: '',
//        region_id: this.currencyToRegion(reqCtx.languageContext.currencyCode, this.config) ||  this.config.defaultRegion,
      });
    }
  }

  public override async deleteCart(
    payload: CartMutationDeleteCart,
    reqCtx: RequestContext
  ): Promise<T> {
    try {
      const client = await this.getClient(reqCtx);
      const medusaId = payload.cart as MedusaCartIdentifier;

      if (medusaId.key) {
        const sessionData = this.getSessionData(reqCtx);
        if (sessionData.activeCartId) {
          delete sessionData.activeCartId;
          this.setSessionData(reqCtx, sessionData);
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

  public override async setShippingInfo(
    payload: CartMutationSetShippingInfo,
    reqCtx: RequestContext
  ): Promise<T> {
    try {
      const client = await this.getClient(reqCtx);
      const medusaId = payload.cart as MedusaCartIdentifier;

      // Set shipping address
      if (payload.shippingAddress) {
        await client.store.cart.update(medusaId.key, {
          shipping_address: {
            first_name: payload.shippingAddress.firstName,
            last_name: payload.shippingAddress.lastName,
            address_1: payload.shippingAddress.streetAddress,
            address_2: payload.shippingAddress.streetNumber || '',
            city: payload.shippingAddress.city,
            postal_code: payload.shippingAddress.postalCode,
            country_code: payload.shippingAddress.countryCode?.toLowerCase() ||
                         reqCtx.taxJurisdiction.countryCode?.toLowerCase() || 'us',
          },
        },         {
          fields: '+items.*'
        }
);
      }

      // Set shipping method
      if (payload.shippingMethod) {
        await client.store.cart.addShippingMethod(medusaId.key, {
          option_id: payload.shippingMethod.key,
        });
      }

      // Get updated cart
      const response = await client.store.cart.retrieve(medusaId.key);

      if (response.cart) {
        return this.parseSingle(response.cart, reqCtx);
      }

      throw new Error('Failed to set shipping info');
    } catch (error) {
      debug('Failed to set shipping info:', error);
      throw new Error(`Failed to set shipping info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public override async setBillingAddress(
    payload: CartMutationSetBillingAddress,
    reqCtx: RequestContext
  ): Promise<T> {
    try {
      const client = await this.getClient(reqCtx);
      const medusaId = payload.cart as MedusaCartIdentifier;

      const response = await client.store.cart.update(medusaId.key, {
        billing_address: {
          first_name: payload.billingAddress.firstName,
          last_name: payload.billingAddress.lastName,
          address_1: payload.billingAddress.streetAddress,
          address_2: payload.billingAddress.streetNumber || '',
          city: payload.billingAddress.city,
          postal_code: payload.billingAddress.postalCode,
          country_code: payload.billingAddress.countryCode?.toLowerCase() ||
                       reqCtx.taxJurisdiction.countryCode?.toLowerCase() || 'us',
        },
        email: payload.notificationEmailAddress,
      },         {
          fields: '+items.*'
        }
);

      if (response.cart) {
        return this.parseSingle(response.cart, reqCtx);
      }

      throw new Error('Failed to set billing address');
    } catch (error) {
      debug('Failed to set billing address:', error);
      throw new Error(`Failed to set billing address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public override async applyCouponCode(
    payload: CartMutationApplyCoupon,
    reqCtx: RequestContext
  ): Promise<T> {
    try {
      const client = await this.getClient(reqCtx);
      const medusaId = payload.cart as MedusaCartIdentifier;

      const response = await client.store.cart.update(medusaId.key, {
        promo_codes: [ payload.couponCode ],
      }, {
        fields: '+items.*'
      });

      if (response.cart) {
        return this.parseSingle(response.cart, reqCtx);
      }

      throw new Error('Failed to apply coupon code');
    } catch (error) {
      debug('Failed to apply coupon code:', error);
      throw new Error(`Failed to apply coupon code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public override async removeCouponCode(
    payload: CartMutationRemoveCoupon,
    reqCtx: RequestContext
  ): Promise<T> {
    try {
      const client = await this.getClient(reqCtx);
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
          return this.parseSingle(response.cart, reqCtx);
        }
      }

      throw new Error('Failed to remove coupon code');
    } catch (error) {
      debug('Failed to remove coupon code:', error);
      throw new Error(`Failed to remove coupon code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public override async checkout(
    payload: CartMutationCheckout,
    reqCtx: RequestContext
  ): Promise<OrderIdentifier> {
    try {
      const client = await this.getClient(reqCtx);
      const medusaId = payload.cart as MedusaCartIdentifier;

      // Complete the cart to create an order
      const response = await client.store.cart.complete(medusaId.key);

      if (response.type === 'order') {
        return MedusaOrderIdentifierSchema.parse({
          key: response.order.id,
          display_id: response.order.display_id,
        });
      }

      throw new Error('Failed to checkout cart');
    } catch (error) {
      debug('Failed to checkout cart:', error);
      throw new Error(`Failed to checkout cart: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public override async changeCurrency(
    payload: CartMutationChangeCurrency,
    reqCtx: RequestContext
  ): Promise<T> {
    try {
      const client = await this.getClient(reqCtx);

      const region = this.config.defaultRegion || this.currencyToRegion(payload.newCurrency, this.config);

      // Get current cart
      const currentCartResponse = await client.store.cart.retrieve(payload.cart.key);
      client.store.cart.update(payload.cart.key, {
        // region_id:  region,
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
        const sessionData = this.getSessionData(reqCtx);
        // Update session to use new cart
        sessionData.activeCartId = newCartResponse.cart.id;
        this.setSessionData(reqCtx, sessionData);

        return this.parseSingle(newCartResponse.cart, reqCtx);
      }

      throw new Error('Failed to change currency');
    } catch (error) {
      debug('Failed to change currency:', error);
      throw new Error(`Failed to change currency: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected async createCart(
    reqCtx: RequestContext,
    currency?: string
  ): Promise<CartIdentifier> {
    try {
      const client = await this.getClient(reqCtx);
      const region = this.currencyToRegion(currency || reqCtx.languageContext.currencyCode || 'EUR', this.config);

      const response = await client.store.cart.create({
        // region_id: region,
        currency_code: currency || reqCtx.languageContext.currencyCode || 'EUR',

      },
    )

      if (response.cart) {
        const cartIdentifier = MedusaCartIdentifierSchema.parse({
          key: response.cart.id,
          // region_id: response.cart.region_id,
        });

        // Store cart ID in session
        const sessionData = this.getSessionData(reqCtx);
        sessionData.activeCartId = cartIdentifier.key;
        this.setSessionData(reqCtx, sessionData);


        return cartIdentifier;
      }

      throw new Error('Failed to create cart');
    } catch (error) {
      debug('Failed to create cart:', error);
      throw new Error(`Failed to create cart: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected async getClient(reqCtx: RequestContext) {
    return new MedusaClient(this.config).getClient(reqCtx);
  }

  protected override parseSingle(remote: MedusaTypes.StoreCart, reqCtx: RequestContext): T {
    const result = this.newModel();

    result.identifier = MedusaCartIdentifierSchema.parse({
      key: remote.id,
      region_id: remote.region_id,
    });

    result.name = '' + (remote.metadata?.['name'] || '');
    result.description = '' + (remote.metadata?.['description'] || '');

    // Calculate totals
    const grandTotal = remote.total || 0;
    const shippingTotal = remote.shipping_total || 0;
    const taxTotal = remote.tax_total || 0;
    const discountTotal = remote.discount_total || 0;
    const subtotal = remote.subtotal || 0;
    const currency = (remote.currency_code || 'EUR').toUpperCase() as Currency;

    result.price = {
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
    };

    // Parse cart items
    for (const remoteItem of remote.items || []) {
      const item = CartItemSchema.parse({});

      item.identifier.key = remoteItem.id;
      item.product.key = remoteItem.product_id || '';
      item.sku = MedusaSKUIdentifierSchema.parse({
        key: remoteItem.variant_id || '',
        productIdentifier: { key: remoteItem.product_id || '' },
      });
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


  protected regionToCurrency(region: string, config: MedusaConfiguration): string {
    switch(region) {
      case 'US':
        return 'USD';
      case 'FI':
        return 'EUR';
      case 'DK':
        return 'DKK';
      case 'GB':
        return 'GBP';
      case 'SE':
        return 'SEK';
    }
    return  'EUR';
  }

  protected currencyToRegion(currency: string, config: MedusaConfiguration): string {
    switch(currency) {
      case 'USD':
        return 'US';
      case 'EUR':
        return 'FI';
      case 'DKK':
        return 'DK';
      case 'GBP':
        return 'GB';
      case 'SEK':
        return 'SE';
    }
    return config.defaultRegion;
  }

  protected getSessionData(reqCtx: RequestContext): MedusaSession {
    return reqCtx.session['medusa'] ? reqCtx.session['medusa'] : MedusaSessionSchema.parse({});
  }

  protected setSessionData(reqCtx: RequestContext, sessionData: MedusaSession): void {
    if (!reqCtx.session['medusa']) {
      reqCtx.session['medusa'] = {};
    }
    reqCtx.session['medusa'] = sessionData;
  }
}
