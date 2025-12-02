import type {
  Cache,
  Cart,
  CartIdentifier,
  CartItem,
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
  ItemCostBreakdown,
  Meta,
  ProductVariantIdentifier,
  RequestContext,
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
  CartProvider,
  CartQueryByIdSchema,
  CartSchema,
  ProductVariantIdentifierSchema,
  Reactionary
} from '@reactionary/core';

import createDebug from 'debug';
import type { MedusaClient } from '../core/client.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import type {
  MedusaCartIdentifier
} from '../schema/medusa.schema.js';
import {
  MedusaCartIdentifierSchema
} from '../schema/medusa.schema.js';
import { handleProviderError, parseMedusaCostBreakdown, parseMedusaItemPrice } from '../utils/medusa-helpers.js';
import type MedusaTypes = require('@medusajs/types');
import type StoreCartPromotion = require('@medusajs/types');

const debug = createDebug('reactionary:medusa:cart');

export class MedusaCartProvider extends CartProvider {
  protected config: MedusaConfiguration;
  /**
   * This controls which fields are always included when fetching a cart
   * You can override this in a subclass to add more fields as needed.
   *
   * example: this.includedFields = [includedFields, '+discounts.*'].join(',');
   */
  protected includedFields: string = ['+items.*'].join(',');

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
  public override async getById(payload: CartQueryById): Promise<Cart> {
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
  public override async add(payload: CartMutationItemAdd): Promise<Cart> {
    try {
      const client = await this.getClient();

      let cartIdentifier = payload.cart;
      if (!cartIdentifier.key) {
        cartIdentifier = await this.createCart();
      }

      const medusaId = cartIdentifier as MedusaCartIdentifier;

      if (debug.enabled) {
        debug(
          'Adding item to cart ID:',
          medusaId.key,
          'SKU:',
          payload.variant.sku,
          'Quantity:',
          payload.quantity
        );
      }

      // TODO: Convert from global SKU identifier, to something medusa understands.....

      // the SKU identifier is supposed to be a globally understood identifier,

      // but medusa only accepts variant IDs , so we have to resolve it somehow...
      const variantId = await this.client.resolveVariantId(payload.variant.sku);

      const response = await client.store.cart.createLineItem(
        medusaId.key,
        {
          variant_id: variantId,
          quantity: payload.quantity,
        },
        {
          fields: this.includedFields,
        }
      );

      if (debug.enabled) {
        debug('Received add item response:', response);
      }

      if (response.cart) {
        return this.parseSingle(response.cart);
      }

      throw new Error('Failed to add item to cart');
    } catch (error) {
      handleProviderError('add item to cart', error);
    }
  }

  @Reactionary({
    inputSchema: CartMutationItemRemoveSchema,
    outputSchema: CartSchema,
  })
  public override async remove(payload: CartMutationItemRemove): Promise<Cart> {
    try {
      const client = await this.getClient();
      const medusaId = payload.cart as MedusaCartIdentifier;

      const response = await client.store.cart.deleteLineItem(
        medusaId.key,
        payload.item.key,
        {
          fields: this.includedFields,
        }
      );

      if (response.parent) {
        return this.parseSingle(response.parent);
      }

      throw new Error('Failed to remove item from cart');
    } catch (error) {
      handleProviderError('remove item from cart', error);
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
      throw new Error(
        'Changing quantity to 0 is not allowed. Use the remove call instead.'
      );
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
          fields: this.includedFields,
        }
      );

      if (response.cart) {
        return this.parseSingle(response.cart);
      }

      throw new Error('Failed to change item quantity');
    } catch (error) {
      handleProviderError('change item quantity', error);
    }
  }

  @Reactionary({
    outputSchema: CartIdentifierSchema,
  })
  public override async getActiveCartId(): Promise<CartIdentifier> {
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
            region_id: (await this.client.getActiveRegion()).id,
          });
        } catch {
          // Cart doesn't exist, create new one
        }
      }

      // For guest users or if no active cart exists, return empty identifier
      return MedusaCartIdentifierSchema.parse({
        key: '',
        region_id: (await this.client.getActiveRegion()).id,
      });
    } catch (error) {
      debug('Failed to get active cart ID:', error);
      return MedusaCartIdentifierSchema.parse({
        key: '',
        region_id: (await this.client.getActiveRegion()).id,
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
          this.client.setSessionData({
            activeCartId: undefined,
          });
        }
      }
      // then delete it. But there is not really a deleteCart method, so we just orphan it.
      //      await client.store.cart.deleteCart(medusaId.key);

      // lets delete all items
      const cartResponse = await client.store.cart.retrieve(medusaId.key);
      if (cartResponse.cart) {
        for (const item of cartResponse.cart.items || []) {
          await client.store.cart.deleteLineItem(medusaId.key, item.id);
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

      const response = await client.store.cart.update(
        medusaId.key,
        {
          promo_codes: [payload.couponCode],
        },
        {
          fields: this.includedFields,
        }
      );

      if (response.cart) {
        return this.parseSingle(response.cart);
      }

      throw new Error('Failed to apply coupon code');
    } catch (error) {
      handleProviderError('apply coupon code', error);
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
        const manualDiscounts = cartResponse.cart.promotions.filter(
          (x) => !x.is_automatic && x.code
        );

        const remainingCodes = (manualDiscounts
          .filter((x) => x.code !== payload.couponCode)
          .map((promotion: MedusaTypes.StoreCartPromotion) => promotion.code) ||
          []) as string[];
        const response = await client.store.cart.update(medusaId.key, {
          promo_codes: remainingCodes || [],
        }, {
          fields: this.includedFields,
        });

        if (response.cart) {
          return this.parseSingle(response.cart);
        }
      }

      throw new Error('Failed to remove coupon code');
    } catch (error) {
      handleProviderError('remove coupon code', error);
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
      const currentCartResponse = await client.store.cart.retrieve(
        payload.cart.key
      );
      client.store.cart.update(
        payload.cart.key,
        {
          region_id: (await this.client.getActiveRegion()).id,
        },
        {
          fields: this.includedFields,
        }
      );
      if (!currentCartResponse.cart) {
        throw new Error('Cart not found');
      }

      // Get the new cart
      const newCartResponse = await client.store.cart.retrieve(
        payload.cart.key
      );

      if (newCartResponse.cart) {
        // Update session to use new cart
        this.client.setSessionData({
          activeCartId: newCartResponse.cart.id,
        });

        return this.parseSingle(newCartResponse.cart);
      }

      throw new Error('Failed to change currency');
    } catch (error) {
      handleProviderError('change currency', error);
    }
  }

  protected async createCart(currency?: string): Promise<CartIdentifier> {
    try {
      const client = await this.getClient();

      const response = await client.store.cart.create(
        {
          currency_code: (
            currency ||
            this.context.languageContext.currencyCode ||
            ''
          ).toLowerCase(),
        },
        {
          fields: this.includedFields,
        }
      );

      if (response.cart) {
        const cartIdentifier = MedusaCartIdentifierSchema.parse({
          key: response.cart.id,
          region_id: response.cart.region_id,
        });

        // Store cart ID in session
        this.client.setSessionData({
          activeCartId: cartIdentifier.key,
        });

        return cartIdentifier;
      }

      throw new Error('Failed to create cart');
    } catch (error) {
      handleProviderError('create cart', error);
    }
  }

  protected async getClient() {
    return this.client.getClient();
  }

  /**
   * Extension point to control the parsing of a single cart item price
   * @param remoteItem
   * @param currency
   * @returns
   */
  protected parseItemPrice(
    remoteItem: MedusaTypes.StoreCartLineItem,
    currency: Currency
  ): ItemCostBreakdown {
    return parseMedusaItemPrice(remoteItem, currency);
  }

  /**
   * Extension point to control the parsing of the cost breakdown of a cart
   * @param remote
   * @returns
   */
  protected parseCostBreakdown(remote: MedusaTypes.StoreCart): CostBreakDown {
    return parseMedusaCostBreakdown(remote);
  }

  /**
   * Extension point to control the parsing of a single cart item
   * @param remoteItem
   * @param currency
   * @returns
   */
  protected parseCartItem(
    remoteItem: MedusaTypes.StoreCartLineItem,
    currency: Currency
  ): CartItem {
    const item: CartItem = {
      identifier: {
        key: remoteItem.id,
      },
      product: {
        key: remoteItem.product_id || '',
      },
      variant: ProductVariantIdentifierSchema.parse({
        sku: remoteItem.variant_sku || '',
      } satisfies ProductVariantIdentifier),
      quantity: remoteItem.quantity || 1,
      price: parseMedusaItemPrice(remoteItem, currency),
    };
    return item;
  }

  /**
   * Extension point to control the parsing of a single cart
   * @param remote
   * @returns
   */
  protected parseSingle(remote: MedusaTypes.StoreCart): Cart {
    const identifier = MedusaCartIdentifierSchema.parse({
      key: remote.id,
      region_id: remote.region_id,
    } satisfies MedusaCartIdentifier);

    const name = '' + (remote.metadata?.['name'] || '');
    const description = '' + (remote.metadata?.['description'] || '');

    const price = this.parseCostBreakdown(remote);

    // Parse cart items
    const items = new Array<CartItem>();

    const allItems = remote.items || [];
    allItems.sort( (a,b) => (a.created_at && b.created_at) ? (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : 0 );
    for (const remoteItem of allItems) {
      items.push(this.parseCartItem(remoteItem, price.grandTotal.currency));
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
        userId: '???',
      },
    } satisfies Cart;

    return result;
  }
}
