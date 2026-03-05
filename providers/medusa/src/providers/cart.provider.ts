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
  NotFoundError,
  ProductVariantIdentifier,
  Promotion,
  RequestContext,
  Result,
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
  error,
  ProductVariantIdentifierSchema,
  Reactionary,
  success,
} from '@reactionary/core';

import createDebug from 'debug';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import type { MedusaCartIdentifier } from '../schema/medusa.schema.js';
import { MedusaCartIdentifierSchema } from '../schema/medusa.schema.js';
import {
  handleProviderError,
  parseMedusaCostBreakdown,
  parseMedusaItemPrice,
} from '../utils/medusa-helpers.js';
import type MedusaTypes from '@medusajs/types';

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
    public medusaApi: MedusaAPI
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
  ): Promise<Result<Cart, NotFoundError>> {
    try {
      const client = await this.getClient();
      const medusaId = payload.cart as MedusaCartIdentifier;

      if (debug.enabled) {
        debug('Fetching cart by ID:', medusaId.key);
      }

      const cartResponse = await client.store.cart.retrieve(medusaId.key, { fields: this.includedFields });

      if (debug.enabled) {
        debug('Received cart response:', cartResponse);
      }

      if (cartResponse.cart) {
        return success(this.parseSingle(cartResponse.cart));
      }

      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    } catch (err) {
      debug('Failed to get cart by ID:', error);

      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    }
  }


  /**
   * Extension point for the `add` operation to control the payload sent to Medusa when adding an item to the cart. By default, it only includes the variant ID and quantity, but you can override it to include more fields as needed.
   *
   * @param payload
   * @param variantId
   * @returns
   */
  protected addPayload(payload: CartMutationItemAdd, variantId: string): MedusaTypes.StoreAddCartLineItem {
    return  {
      variant_id: variantId,
      quantity: payload.quantity,
    };
  }

  @Reactionary({
    inputSchema: CartMutationItemAddSchema,
    outputSchema: CartSchema,
  })
  public override async add(
    payload: CartMutationItemAdd
  ): Promise<Result<Cart>> {
    try {
      const client = await this.getClient();

      let cartIdentifier = payload.cart;
      if (!cartIdentifier) {
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
      const variantId = await this.medusaApi.resolveVariantId(payload.variant.sku);

      const response = await client.store.cart.createLineItem(
        medusaId.key,
        this.addPayload(payload, variantId),
        {
          fields: this.includedFields,
        }

      );

      if (debug.enabled) {
        debug('Received add item response:', response);
      }

      if (response.cart) {
        return success(this.parseSingle(response.cart));
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
  public override async remove(
    payload: CartMutationItemRemove
  ): Promise<Result<Cart>> {
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
        return success(this.parseSingle(response.parent));
      }

      throw new Error('Failed to remove item from cart');
    } catch (error) {
      handleProviderError('remove item from cart', error);
    }
  }

  /**
   * Extension point for the `changeQuantity` operation to control the payload sent to Medusa when changing the quantity of an item in the cart. By default, it only includes the new quantity, but you can override it to include more fields as needed.
   * @param payload
   * @returns
   */
  protected changeQuantityPayload(payload: CartMutationItemQuantityChange): MedusaTypes.StoreUpdateCartLineItem {
    return {
      quantity: payload.quantity,
    };
  }


  @Reactionary({
    inputSchema: CartMutationItemQuantityChangeSchema,
    outputSchema: CartSchema,
  })
  public override async changeQuantity(
    payload: CartMutationItemQuantityChange
  ): Promise<Result<Cart>> {
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
        this.changeQuantityPayload(payload),
        {
          fields: this.includedFields,
        }
      );

      if (response.cart) {
        return success(this.parseSingle(response.cart));
      }

      throw new Error('Failed to change item quantity');
    } catch (error) {
      handleProviderError('change item quantity', error);
    }
  }

  @Reactionary({
    outputSchema: CartIdentifierSchema,
  })
  public override async getActiveCartId(): Promise<
    Result<CartIdentifier, NotFoundError>
  > {
    try {
      const client = await this.getClient();
      const sessionData = this.medusaApi.getSessionData();
      // Check if customer has an active cart in session storage or create new one
      const activeCartId = sessionData.activeCartId;

      if (activeCartId) {
        try {
          await client.store.cart.retrieve(activeCartId);
          return success(
            MedusaCartIdentifierSchema.parse({
              key: activeCartId,
              region_id: (await this.medusaApi.getActiveRegion()).id,
            })
          );
        } catch {
          // Cart doesn't exist, create new one
        }
      }

      // For guest users or if no active cart exists, return empty identifier
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: undefined,
      });
    } catch (err) {
      debug('Failed to get active cart ID:', err);

      return error<NotFoundError>({
        type: 'NotFound',
        identifier: undefined,
      });
    }
  }

  @Reactionary({
    cache: false,
    inputSchema: CartMutationDeleteCartSchema,
  })
  public override async deleteCart(
    payload: CartMutationDeleteCart
  ): Promise<Result<void>> {
    try {
      const client = await this.getClient();
      const medusaId = payload.cart as MedusaCartIdentifier;

      if (medusaId.key) {
        const sessionData = this.medusaApi.getSessionData();
        if (sessionData.activeCartId) {
          delete sessionData.activeCartId;
          this.medusaApi.setSessionData({
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

      return success(undefined);
    } catch (error) {
      debug('Failed to delete cart:', error);
      return success(undefined);
    }
  }


  /**
   * Extension point to apply a coupon code to the cart. By default, it only includes the coupon code, but you can override it to include more fields as needed.
   * @param payload
   * @returns
   */
  protected applyCouponCodePayload(payload: CartMutationApplyCoupon): MedusaTypes.StoreCartAddPromotion {
    return {
      promo_codes: [payload.couponCode],
    };
  }

  @Reactionary({
    inputSchema: CartMutationApplyCouponSchema,
    outputSchema: CartSchema,
  })
  public override async applyCouponCode(
    payload: CartMutationApplyCoupon
  ): Promise<Result<Cart>> {
    try {
      const client = await this.getClient();
      const medusaId = payload.cart as MedusaCartIdentifier;


      const response = await client.client.fetch<MedusaTypes.StoreCartResponse>(
        `/store/carts/${medusaId.key}/promotions`,
        {
          method: "POST",
          body: this.applyCouponCodePayload(payload),
          query: {
            fields: this.includedFields,
          }
        }
      );

/** When PR: https://github.com/medusajs/medusa/pull/14850 gets merged, revert to the below
      const response = await client.store.cart.addPromotionCodes(
        medusaId.key,
        this.applyCouponCodePayload(payload),
        {
          fields: this.includedFields,
        }
      );
 */
      if (response.cart) {
        return success(this.parseSingle(response.cart));
      }

      throw new Error('Failed to apply coupon code');
    } catch (error) {
      handleProviderError('apply coupon code', error);
    }
  }

  /**
   * Extension point to remove a coupon code from the cart. By default, it only includes the coupon code to be removed, but you can override it to include more fields as needed.
   * @param payload
   * @returns
   */
  protected removeCouponCodePayload(payload: CartMutationRemoveCoupon): MedusaTypes.StoreCartRemovePromotion {
    return {
      promo_codes: [payload.couponCode],

    };
  }

  @Reactionary({
    inputSchema: CartMutationRemoveCouponSchema,
    outputSchema: CartSchema,
  })
  public override async removeCouponCode(
    payload: CartMutationRemoveCoupon
  ): Promise<Result<Cart>> {
    try {
      const client = await this.getClient();
      const medusaId = payload.cart as MedusaCartIdentifier;

      const response = await client.client.fetch<MedusaTypes.StoreCartResponse>(
        `/store/carts/${medusaId.key}/promotions`,
        {
          method: "DELETE",
          body: this.removeCouponCodePayload(payload),
          query: {
            fields: this.includedFields,
          }
        }
      );

      /*

      const response = await client.store.cart.removePromotionCodes(
        medusaId.key,
        this.removeCouponCodePayload(payload),
        {
          fields: this.includedFields,
        }
      );
      */

      if (response.cart) {
        return success(this.parseSingle(response.cart));
      }
      throw new Error('Failed to remove coupon code');
    } catch (error) {
      handleProviderError('remove coupon code', error);
    }
  }

  /**
   * Extension point to control the payload sent to Medusa when changing the currency of the cart. By default, it only includes the new region ID, but you can override it to include more fields as needed.
   * @param payload
   * @param newRegionId
   * @returns
   */
  protected changeCurrencyPayload(payload: CartMutationChangeCurrency, newRegionId: string): MedusaTypes.StoreUpdateCart {
    return {
      region_id: newRegionId,
    };
  }

  @Reactionary({
    inputSchema: CartMutationChangeCurrencySchema,
    outputSchema: CartSchema,
  })
  public override async changeCurrency(
    payload: CartMutationChangeCurrency
  ): Promise<Result<Cart>> {
    try {
      const client = await this.getClient();

      const newRegionId = (await this.medusaApi.getActiveRegion()).id;
      const updatedCartResponse = await client.store.cart.update(
        payload.cart.key,
        this.changeCurrencyPayload(payload, newRegionId),
        {
          fields: this.includedFields,
        }
      );

      if (updatedCartResponse.cart) {
        // Update session to use new cart
        this.medusaApi.setSessionData({
          activeCartId: updatedCartResponse.cart.id,
        });

        return success(this.parseSingle(updatedCartResponse.cart));
      }

      throw new Error('Failed to change currency');
    } catch (error) {
      handleProviderError('change currency', error);
    }
  }

  /**
   * Extension point to control the payload sent to Medusa when creating a cart. By default, it only includes the currency code, but you can override it to include more fields as needed.
   * @param currency
   * @returns
   */
  protected createCartPayload(currency?: string): MedusaTypes.StoreCreateCart {
    return {
        currency_code: (
            currency ||
            this.context.languageContext.currencyCode ||
            ''
        ).toLowerCase(),
    };
  }


  protected async createCart(currency?: string): Promise<CartIdentifier> {
    try {
      const client = await this.getClient();

      const response = await client.store.cart.create(
        this.createCartPayload(currency),
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
        this.medusaApi.setSessionData({
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
    return this.medusaApi.getClient();
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
    allItems.sort((a, b) =>
      a.created_at && b.created_at
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : 0
    );
    for (const remoteItem of allItems) {
      items.push(this.parseCartItem(remoteItem, price.grandTotal.currency));
    }


    const appliedPromotions = [];
    if (remote.promotions) {
      for (const promo of remote.promotions) {

        const promotionName = promo.code;
        let promoDescription = '';
        if (promo.application_method?.type === 'percentage') {
          promoDescription = `-${promo.application_method.value}%`;
        }
        if (promo.application_method?.type === 'fixed') {
          promoDescription = `-${promo.application_method.value} ${price.grandTotal.currency}`;
        }
        appliedPromotions.push({
          code: promo.code || '',
          isCouponCode: promo.is_automatic ? false : true,
          name: promotionName || promoDescription,
          description: promoDescription
        } satisfies Promotion);
      }
    }

    const result = {
      identifier,
      name,
      description,
      price,
      items,
      appliedPromotions,
      userId: {
        userId: '???',
      },
    } satisfies Cart;

    return result;
  }
}
