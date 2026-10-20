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
  CartMutationCreateCartSchema,
  CartMutationDeleteCartSchema,
  CartMutationItemAddSchema,
  CartMutationItemQuantityChangeSchema,
  CartMutationItemRemoveSchema,
  CartMutationRemoveCouponSchema,
  CartMutationRenameCartSchema,
  CartPaginatedSearchResultSchema,
  CartQueryByIdSchema,
  CartQueryListSchema,
  CartSchema,
  error,
  Reactionary,
  success
} from '@reactionary/core';

import { FetchError } from '@medusajs/js-sdk';
import type { StoreCart} from '@medusajs/types';
import { type StoreAddCartLineItem, type StoreCartAddPromotion, type StoreCartRemovePromotion, type StoreCartResponse, type StoreCreateCart, type StoreUpdateCart, type StoreUpdateCartLineItem } from '@medusajs/types';
import createDebug from 'debug';
import { MedusaAdminAPI, type MedusaAPI } from '../core/client.js';
import type { MedusaCartFactory, ParseMedusaCartPaginatedSearchResultInput } from '../factories/cart/cart.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { MedusaCachedPluginListSchema, type MedusaCartIdentifier } from '../schema/medusa.schema.js';
import {
  handleProviderError
} from '../utils/medusa-helpers.js';

const debug = createDebug('reactionary:medusa:cart');

/**
 * A cart as returned when the `customer.id` relation field is requested;
 * `StoreCart` itself has no `customer` property.
 */
interface MedusaOwnedCart extends StoreCart {
  customer?: { id: string } | null;
}

/** Response shape of the cart-ownership plugin's `GET /store/customers/me/carts`. */
interface MedusaOwnedCartsResponse {
  carts: MedusaOwnedCart[];
  count: number;
  offset: number;
  limit: number;
}

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
  protected includedFields: string = ['+items.*', '+items.adjustments.*', '+shipping_methods.adjustments.*'].join(',');

  /**
   * Fields requested when listing owned carts, both via the cart-ownership
   * endpoint and via the session-tracked fallback. Every entry must be in
   * the allowed field set of both routes; `customer.id` stands in for
   * `customer_id`, which is not an allowed field (see normalizeOwnedCart).
   */
  protected ownedCartListFields: string = ['id', 'updated_at', 'metadata', 'items.id', 'customer.id'].join(',');

  /** Sort order for the server-side owned-carts listing. */
  protected ownedCartListOrder = '-updated_at';

  /**
   * Package name of the optional backend plugin that serves
   * `GET /store/customers/me/carts` (a logged-in customer's open carts).
   */
  protected cartOwnershipPluginName = '@solteq-excom/medusa-cart-ownership';

  /**
   * How long a backend's plugin list stays cached. Bounds how late a newly
   * (un)installed cart-ownership plugin is noticed.
   */
  protected pluginDetectionTtlSeconds = 900;

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

  @Reactionary({
    inputSchema: CartQueryListSchema,
    outputSchema: CartPaginatedSearchResultSchema,
    cache: false
  })
  public override async listCarts(payload: CartQueryList): Promise<Result<CartPaginatedSearchResult>> {
    let data: ParseMedusaCartPaginatedSearchResultInput | null = null;
    if (await this.shouldUseOwnershipEndpoint(payload)) {
      data = await this.listCartsViaOwnershipEndpoint(payload);
    }
    data ??= await this.listCartsFromSession(payload);

    return success(this.factory.parseCartPaginatedSearchResult(this.context, data, payload));
  }

  /**
   * The server-side owned-carts listing only applies to a logged-in
   * customer's own carts: a company bucket and anonymous/guest carts are
   * only known to the session, and the backend only serves the route when
   * the cart-ownership plugin is installed.
   */
  protected async shouldUseOwnershipEndpoint(payload: CartQueryList): Promise<boolean> {
    if (payload.search.company) {
      return false;
    }
    if (this.context.session.identityContext.identity.type !== 'Registered') {
      return false;
    }
    return await this.isCartOwnershipPluginEnabled();
  }

  /**
   * Lists the customer's open carts through the cart-ownership plugin's
   * `GET /store/customers/me/carts`. Returns null when the backend turns
   * out not to serve the route after all (404: plugin configured but not
   * built; 401: the token is no longer valid), so the caller falls back to
   * the session-tracked list. Other errors are real backend faults and
   * propagate.
   */
  protected async listCartsViaOwnershipEndpoint(payload: CartQueryList): Promise<ParseMedusaCartPaginatedSearchResultInput | null> {
    const client = await this.getClient();
    const { pageNumber, pageSize } = payload.search.paginationOptions;

    try {
      const response = await client.client.fetch<MedusaOwnedCartsResponse>('/store/customers/me/carts', {
        method: 'GET',
        query: {
          fields: this.ownedCartListFields,
          limit: pageSize,
          offset: (pageNumber - 1) * pageSize,
          order: this.ownedCartListOrder,
        },
      });

      return {
        items: response.carts.map((cart) => this.normalizeOwnedCart(cart)),
        totalCount: response.count,
      };
    } catch (err) {
      if (this.shouldFallBackToSessionList(err)) {
        debug('Owned-carts endpoint unavailable, falling back to session-tracked carts:', err);
        return null;
      }
      throw err;
    }
  }

  /**
   * Lists carts from the ids tracked in the session: the behavior from
   * before the cart-ownership plugin existed, and still the only source for
   * anonymous/guest carts and company buckets.
   */
  protected async listCartsFromSession(payload: CartQueryList): Promise<ParseMedusaCartPaginatedSearchResultInput> {
    const client = await this.getClient();

    const sessionData = this.medusaApi.getSessionData();
    let cartCollection = payload.search.company ? sessionData.allOwnedCarts?.[payload.search.company.taxIdentifier] : sessionData.allOwnedCarts?.['_me']

    const totalCount = cartCollection ? cartCollection.length : 0;
    if (cartCollection) {
      cartCollection = cartCollection.slice((payload.search.paginationOptions.pageNumber - 1) * payload.search.paginationOptions.pageSize, payload.search.paginationOptions.pageNumber * payload.search.paginationOptions.pageSize);
    } else {
      cartCollection = [];
    }

    const allPromises = cartCollection.map((cartIdentifier) => client.store.cart.retrieve(cartIdentifier.key, { fields: this.ownedCartListFields }));
    const responses = await Promise.all(allPromises);
    const carts = responses.map((response) => response.cart).filter((cart): cart is StoreCart => !!cart);

    return {
      items: carts.map((cart) => this.normalizeOwnedCart(cart)),
      totalCount: totalCount,
    };
  }

  /**
   * The factory reads `customer_id`, but only the `customer.id` relation is
   * an allowed list field, so copy it over when `customer_id` itself wasn't
   * returned.
   */
  protected normalizeOwnedCart(cart: MedusaOwnedCart): StoreCart {
    return { ...cart, customer_id: cart.customer_id ?? cart.customer?.id };
  }

  /** A 404 (route not served) or 401 (token no longer valid) degrades to the session list. */
  protected shouldFallBackToSessionList(err: unknown): boolean {
    return err instanceof FetchError && (err.status === 404 || err.status === 401);
  }

  /**
   * Checks whether the backend has the cart-ownership plugin, by its name in
   * core's `GET /admin/plugins`. Detection must never break cart listing, so
   * any failure just reports the plugin as absent.
   */
  protected async isCartOwnershipPluginEnabled(): Promise<boolean> {
    const plugins = await this.fetchEnabledPlugins();
    return plugins.includes(this.cartOwnershipPluginName);
  }

  /**
   * The backend's configured plugin list, kept in the reactionary cache
   * (shared across sessions) so not every request re-asks the admin API.
   * Failures are not cached: a plugin-less answer from here only costs the
   * fallback behavior, while caching a transient failure would hide the
   * plugin for a whole TTL.
   */
  protected async fetchEnabledPlugins(): Promise<string[]> {
    const cacheKey = `medusa:plugins:${this.config.apiUrl}`;
    const cached = await this.cache.get(cacheKey, MedusaCachedPluginListSchema);
    if (cached) {
      return cached.plugins;
    }

    try {
      const adminClient = await new MedusaAdminAPI(this.config, this.context).getClient();
      const response = await adminClient.client.fetch<{ plugins: { name: string }[] }>('/admin/plugins', { method: 'GET' });
      const plugins = response.plugins.map((plugin) => plugin.name);
      await this.cache.put(cacheKey, { plugins }, { ttlSeconds: this.pluginDetectionTtlSeconds, dependencyIds: [] });
      return plugins;
    } catch (err) {
      debug('Failed to list backend plugins:', err);
      return [];
    }
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
      debug('Failed to get cart by ID:', err);

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
      const productResponse = await client.store.product.list({
        variants: {
          sku: payload.variant.sku,
        },
        limit: 1
      });
      if (productResponse.products.length === 0) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload,
        });
      }
      const product = productResponse.products[0];
      const variant = product.variants?.find((v) => v.sku === payload.variant.sku);
      if (!variant) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload,
        });
      }
      const variantId = variant.id;
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
  protected async createCartPayload(payload: CartMutationCreateCart): Promise<StoreCreateCart> {

    const newRegionId = (await this.medusaApi.getActiveRegion()).id;


    return {
        currency_code: (
            this.context.languageContext.currencyCode ||
            'EUR'
        ).toLowerCase(),
        locale: this.context.languageContext.locale,
        region_id: newRegionId,
        metadata: {
          name: payload.name,
        }
    };
  }


  /**
   * Session tracking is skipped for a logged-in customer's own carts when
   * the backend has the cart-ownership plugin: the backend attributes the
   * cart to the customer at creation and lists it server-side. Anonymous
   * carts and company buckets are still only known to the session.
   */
  protected async shouldTrackOwnedCartInSession(payload: CartMutationCreateCart): Promise<boolean> {
    if (payload.company) {
      return true;
    }
    if (this.context.session.identityContext.identity.type !== 'Registered') {
      return true;
    }
    return !(await this.isCartOwnershipPluginEnabled());
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

  /**
   * Removes every trace of a cart from the session: the active cart marker
   * (when it points at this cart) and the entry in every owned-carts
   * collection. Used when a cart turns out to be deleted or stale upstream.
   */
  protected pruneCartFromSession(cartKey: string) {
    const sessionData = this.medusaApi.getSessionData();
    if (sessionData.activeCartId?.key === cartKey) {
      delete sessionData.activeCartId;
      this.medusaApi.setSessionData({ activeCartId: undefined });
    }
    if (sessionData.allOwnedCarts) {
      const prunedCollections = Object.fromEntries(
        Object.entries(sessionData.allOwnedCarts).map(([collection, carts]) => [
          collection,
          carts.filter((cart) => cart.key !== cartKey),
        ]),
      );
      this.medusaApi.setSessionData({ allOwnedCarts: prunedCollections });
    }
  }

  protected isNotFoundError(err: unknown): boolean {
    return err instanceof FetchError && err.status === 404;
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

  @Reactionary({
    inputSchema: CartMutationCreateCartSchema,
    outputSchema: CartSchema,
  })
  public override async createCart(
    payload: CartMutationCreateCart
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const client = await this.getClient();

      const response = await client.store.cart.create(
        await this.createCartPayload(payload),
        {
          fields: this.includedFields,
        }
      );

      if (response.cart) {
        if (await this.shouldTrackOwnedCartInSession(payload)) {
          this.addCartToOwnedList(this.factory.parseCartIdentifier(this.context, response.cart), payload.company);
        }
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
          activeCartId = sessionData.allOwnedCarts['_me'][0] || undefined;
        }
      }
      if (activeCartId) {
        // check if it still exists; the SDK throws a FetchError 404 for a
        // deleted cart rather than returning an empty response
        let remoteCart;
        try {
          const response = await client.store.cart.retrieve(activeCartId.key, { fields: 'id,region_id' });
          remoteCart = response.cart;
        } catch (retrieveError) {
          if (!this.isNotFoundError(retrieveError)) {
            throw retrieveError;
          }
        }
        if (!remoteCart) {
          // if it doesn't exist, remove it from session and return not found
          this.pruneCartFromSession(activeCartId.key);
          return error<NotFoundError>({
            type: 'NotFound',
            identifier: activeCartId,
          });
        }
        return success(this.factory.parseCartIdentifier(this.context, remoteCart));
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
        // remove the cart from the session: the active cart marker (only when
        // it points at this cart) and every owned-carts collection
        this.pruneCartFromSession(medusaId.key);
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
    } catch (err) {
      if (this.isNotFoundError(err)) {
        // the cart is already gone upstream; the session is pruned, so the
        // delete is complete
        return success(undefined);
      }
      handleProviderError('delete cart', err);
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
          activeCartId: this.factory.parseCartIdentifier(this.context, updatedCartResponse.cart),
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
