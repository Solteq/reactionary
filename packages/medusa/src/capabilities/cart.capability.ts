import type {
  Cache,
  CartFactory,
  CartFactoryCartOutput,
  CartFactoryIdentifierOutput,
  CartFactoryWithOutput,
  CartMutationApplyCoupon,
  CartMutationChangeCurrency,
  CartMutationCreateCart,
  CartMutationDeleteCart,
  CartMutationItemAdd,
  CartMutationItemQuantityChange,
  CartMutationItemRemove,
  CartMutationRemoveCoupon,
  CartMutationRenameCart,
  CartPaginatedSearchResult,
  CartQueryById,
  CartQueryList,
  CompanyIdentifier,
  InvalidInputError,
  NotFoundError,
  RequestContext,
  Result
} from '@reactionary/core';
import {
  CartCapability,
  CartIdentifierSchema,
  CartMutationApplyCouponSchema,
  CartMutationChangeCurrencySchema,
  CartMutationDeleteCartSchema,
  CartMutationItemAddSchema,
  CartMutationItemQuantityChangeSchema,
  CartMutationItemRemoveSchema,
  CartMutationRemoveCouponSchema,
  CartMutationRenameCartSchema,
  CartQueryByIdSchema,
  CartSchema,
  error,
  Reactionary,
  success
} from '@reactionary/core';

import type { StoreCart} from '@medusajs/types';
import { type StoreAddCartLineItem, type StoreCartAddPromotion, type StoreCartRemovePromotion, type StoreCartResponse, type StoreCreateCart, type StoreUpdateCart, type StoreUpdateCartLineItem } from '@medusajs/types';
import createDebug from 'debug';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaCartFactory } from '../factories/cart/cart.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import type { MedusaCartIdentifier } from '../schema/medusa.schema.js';
import {
  handleProviderError
} from '../utils/medusa-helpers.js';

const debug = createDebug('reactionary:medusa:cart');

export class MedusaCartCapability<
  TFactory extends CartFactory = MedusaCartFactory,
> extends CartCapability<
  CartFactoryCartOutput<TFactory>,
  CartFactoryIdentifierOutput<TFactory>
> {
  protected config: MedusaConfiguration;
  protected factory: CartFactoryWithOutput<TFactory>;
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
    public medusaApi: MedusaAPI,
    factory: CartFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  public override async listCarts(payload: CartQueryList): Promise<Result<CartPaginatedSearchResult>> {
    const client = await this.getClient();

    const sessionData = this.medusaApi.getSessionData();
    let cartCollection = payload.search.company ? sessionData.allOwnedCarts?.[payload.search.company.taxIdentifier] : sessionData.allOwnedCarts?.['_me']

    const totalCount = cartCollection ? cartCollection.length : 0;
    if (cartCollection) {
      cartCollection = cartCollection.slice((payload.search.paginationOptions.pageNumber - 1) * payload.search.paginationOptions.pageSize, payload.search.paginationOptions.pageNumber * payload.search.paginationOptions.pageSize);
    } else {
      cartCollection = [];
    }

    const shortFields = ['id', 'customerId', 'updated_at', 'metadata.*', '+items.id'].join(',');

    const allPromises = cartCollection.map((cartIdentifier) => client.store.cart.retrieve(cartIdentifier.key, { fields: this.includedFields }));
    const responses = await Promise.all(allPromises);
    const carts = responses.map((response) => response.cart).filter((cart): cart is StoreCart => !!cart);

    return success(this.factory.parseCartPaginatedSearchResult(this.context,
      {
        items: carts,
        totalCount: totalCount
      }, payload));
  }

  @Reactionary({
    inputSchema: CartQueryByIdSchema,
    outputSchema: CartSchema,
  })
  public override async getById(
    payload: CartQueryById
  ): Promise<Result<CartFactoryCartOutput<TFactory>, NotFoundError>> {
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
        return success(this.factory.parseCart(this.context, cartResponse.cart));
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
  protected addPayload(payload: CartMutationItemAdd, variantId: string): StoreAddCartLineItem {
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
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const client = await this.getClient();

      const cartIdentifier = payload.cart;
      if (!cartIdentifier) {
        return error<InvalidInputError>({
          type: 'InvalidInput',
          error: 'Cart identifier is required to add item to cart',
        });
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
        return success(this.factory.parseCart(this.context, response.cart));
      }

      throw new Error('Failed to add item to cart');
    } catch (error) {
      handleProviderError('add item to cart', error);
    }
  }


  @Reactionary({
    inputSchema: CartMutationRenameCartSchema,
    outputSchema: CartSchema,
  })
  public override async renameCart(
    payload: CartMutationRenameCart
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {

    const client = await this.getClient();
    const medusaId = payload.cart as MedusaCartIdentifier;

    // Medusa doesn't have a rename cart endpoint, so we have to use metadata to store the name, and update it using the update cart endpoint.

    // Get the current cart data to preserve existing metadata
    const cartResponse = await client.store.cart.retrieve(medusaId.key, { fields: ['metadata.*'].join(',') });
    if (!cartResponse.cart) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.cart,
      });
    }

    const currentMetadata = cartResponse.cart.metadata || {};

    // Update the name in metadata
    const updatedMetadata = {
      ...currentMetadata,
      name: payload.newName,
    };

    // Update the cart with the new metadata
    const response = await client.store.cart.update(
      medusaId.key,
      {
        metadata: updatedMetadata,
      },
      {
        fields: this.includedFields,
      }
    );

    if (response.cart) {
      return success(this.factory.parseCart(this.context, response.cart));
    }

    throw new Error('Failed to rename cart');
  }

  /**
   * Extension point to control the payload sent to Medusa when creating a cart. By default, it only includes the currency code, but you can override it to include more fields as needed.
   * @param currency
   * @returns
   */
  protected createCartPayload(payload: CartMutationCreateCart): StoreCreateCart {
    return {
        currency_code: (
            this.context.languageContext.currencyCode ||
            'EUR'
        ).toLowerCase(),
        locale: this.context.languageContext.locale || 'en',
        metadata: {
          name: payload.name,
        }
    };
  }


  protected addCartToOwnedList(cartIdentifier: MedusaCartIdentifier, companyId?: CompanyIdentifier) {
    const sessionData = this.medusaApi.getSessionData();
    const companyIdToUse = companyId ? companyId.taxIdentifier : '_me';
    if (sessionData.allOwnedCarts) {
      sessionData.allOwnedCarts[companyIdToUse] = [
        ...(sessionData.allOwnedCarts[companyIdToUse] || []),
        cartIdentifier,
      ];
    } else {
      sessionData.allOwnedCarts = {
        [companyIdToUse]: [cartIdentifier],
      };
    }
    this.medusaApi.setSessionData(sessionData);
  }

  protected removeCartFromOwnedList(cartIdentifier: MedusaCartIdentifier, company?: CompanyIdentifier) {
    const sessionData = this.medusaApi.getSessionData();
    const companyIdToUse = company ? company.taxIdentifier : '_me';
    if (sessionData.allOwnedCarts && sessionData.allOwnedCarts[companyIdToUse]) {
      sessionData.allOwnedCarts[companyIdToUse] = sessionData.allOwnedCarts[companyIdToUse].filter(
        (c) => c.key !== cartIdentifier.key
      );
      this.medusaApi.setSessionData(sessionData);
    }
  }


  public override async createCart(
    payload: CartMutationCreateCart
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const client = await this.getClient();

      const response = await client.store.cart.create(
        this.createCartPayload(payload),
        {
          fields: this.includedFields,
        }
      );

      if (response.cart) {
        this.addCartToOwnedList(this.factory.parseCartIdentifier(this.context, response.cart), payload.company);
        // Store cart ID in session
        this.medusaApi.setSessionData({
          activeCartId: this.factory.parseCartIdentifier(this.context, response.cart),
        });

        return success(this.factory.parseCart(this.context, response.cart));
      }

      throw new Error('Failed to create cart');
    } catch (error) {
      handleProviderError('create cart', error);
    }
  }

  @Reactionary({
    inputSchema: CartMutationItemRemoveSchema,
    outputSchema: CartSchema,
  })
  public override async remove(
    payload: CartMutationItemRemove
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
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
        return success(this.factory.parseCart(this.context, response.parent));
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
  protected changeQuantityPayload(payload: CartMutationItemQuantityChange): StoreUpdateCartLineItem {
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
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
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
        return success(this.factory.parseCart(this.context, response.cart));
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
    Result<CartFactoryIdentifierOutput<TFactory>, NotFoundError>
  > {
    try {
      const client = await this.getClient();
      const sessionData = this.medusaApi.getSessionData();

      let activeCartId = sessionData.activeCartId;
      if (!activeCartId && sessionData  && sessionData.allOwnedCarts) {
        if (sessionData.allOwnedCarts['_me']) {
          activeCartId = sessionData.allOwnedCarts['_me'][0] || '';
        }
      }
      if (activeCartId) {
        // check if it still exists
        const response = await client.store.cart.retrieve(activeCartId.key, { fields: 'id,region' });
        if (!response.cart) {
          // if it doesn't exist, remove it from session and return not found
          delete sessionData.activeCartId;
          this.medusaApi.setSessionData({
            activeCartId: undefined,
          });
          return error<NotFoundError>({
            type: 'NotFound',
            identifier: activeCartId,
          });
        }
        return success(this.factory.parseCartIdentifier(this.context, response.cart!));
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
  protected applyCouponCodePayload(payload: CartMutationApplyCoupon): StoreCartAddPromotion {
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
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const client = await this.getClient();
      const medusaId = payload.cart as MedusaCartIdentifier;


      const response = await client.client.fetch<StoreCartResponse>(
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
        return success(this.factory.parseCart(this.context, response.cart));
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
  protected removeCouponCodePayload(payload: CartMutationRemoveCoupon): StoreCartRemovePromotion {
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
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const client = await this.getClient();
      const medusaId = payload.cart as MedusaCartIdentifier;

      const response = await client.client.fetch<StoreCartResponse>(
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
        return success(this.factory.parseCart(this.context, response.cart));
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
  protected changeCurrencyPayload(payload: CartMutationChangeCurrency, newRegionId: string): StoreUpdateCart {
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
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
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
          activeCartId: this.factory.parseCartIdentifier(this.context, updatedCartResponse),
        });

        return success(this.factory.parseCart(this.context, updatedCartResponse.cart));
      }

      throw new Error('Failed to change currency');
    } catch (error) {
      handleProviderError('change currency', error);
    }
  }

  protected async getClient() {
    return this.medusaApi.getClient();
  }

}
