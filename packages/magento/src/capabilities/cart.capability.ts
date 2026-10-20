import {
  type Cache,
  type CartFactory,
  type CartFactoryCartOutput,
  type CartFactoryWithOutput,
  type CartIdentifier,
  type CartMutationApplyCoupon,
  type CartMutationChangeCurrency,
  type CartMutationCreateCart,
  type CartMutationDeleteCart,
  type CartMutationItemAdd,
  type CartMutationItemQuantityChange,
  type CartMutationItemRemove,
  type CartMutationRemoveCoupon,
  type CartMutationRenameCart,
  type CartPaginatedSearchResult,
  type CartQueryById,
  type CartQueryList,
  type CompanyIdentifier,
  type InvalidInputError,
  type NotFoundError,
  type RequestContext,
  type Result,
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
  CompanyIdentifierSchema,
  Reactionary,
  success,
  error,
} from '@reactionary/core';
import createDebug from 'debug';
import * as z from 'zod';
import type { MagentoClient } from '../core/client.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import { MagentoCartIdentifierSchema } from '../schema/magento.schema.js';
import {
  resolveMagentoCartKey,
  type MagentoCartFactory,
} from '../factories/cart/cart.factory.js';
import type { MagentoCartData } from '../schema/cart.types.js';
import {
  handleMagentoProviderError,
  isMagentoNotFoundError,
} from '../utils/magento-errors.js';

const debug = createDebug('reactionary:magento:cart');

/**
 * Session keys (per cart key) for the cart data Magento has no quote field
 * for: the reactionary cart name and the company a cart was created for.
 */
const CART_NAME_SESSION_PREFIX = 'cart:name:';
const CART_COMPANY_SESSION_PREFIX = 'cart:company:';

function readStoredCompany(raw: string | null): CompanyIdentifier | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = CompanyIdentifierSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export class MagentoCartCapability<
  TFactory extends CartFactory = MagentoCartFactory,
> extends CartCapability<CartFactoryCartOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: CartFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: CartFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: CartQueryByIdSchema,
    outputSchema: CartSchema,
  })
  public override async getById(
    payload: CartQueryById,
  ): Promise<Result<CartFactoryCartOutput<TFactory>, NotFoundError>> {
    try {
      const key = payload.cart.key;
      // A guest cart is only reachable by its key; a customer's is `carts/mine`.
      if (!key && !(await this.magentoApi.getCustomerToken())) {
        return error<NotFoundError>({
          type: 'NotFound',
          identifier: payload.cart,
        });
      }

      const data = await this.fetchCartData(key);
      return success(this.factory.parseCart(this.context, data));
    } catch (err) {
      return handleMagentoProviderError('get cart', err, payload.cart);
    }
  }

  /**
   * Fetches the cart (with merged totals) and parses it into the model. Shared
   * by all mutations that return the resulting cart.
   */
  protected async respondWithCart(
    key: string,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const data = await this.fetchCartData(key);
    return success(this.factory.parseCart(this.context, data));
  }

  /**
   * Add an item. An empty cart key adds to the active cart, creating a new
   * one when there is none (the core contract: "If no cart exists, create a
   * new one").
   */
  @Reactionary({
    inputSchema: CartMutationItemAddSchema,
    outputSchema: CartSchema,
  })
  public override async add(
    payload: CartMutationItemAdd,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      let key = payload.cart.key;
      if (!key) {
        key = (await this.resolveActiveCartKey()) ?? (await this.createNewCart()).key;
      }

      await this.magentoApi.addItemToCart(key, {
        sku: payload.variant.sku,
        qty: payload.quantity,
      });

      return await this.respondWithCart(key);
    } catch (err) {
      return handleMagentoProviderError('add item to cart', err, payload.cart);
    }
  }

  /**
   * Remove an item. Per the core contract a cart left empty is deleted:
   * Magento has no storefront call to delete a quote, so the emptied quote is
   * released from the session (see `forgetCart`) and returned as is.
   */
  @Reactionary({
    inputSchema: CartMutationItemRemoveSchema,
    outputSchema: CartSchema,
  })
  public override async remove(
    payload: CartMutationItemRemove,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const itemId = this.parseItemId(payload.item.key);
      if (itemId === undefined) {
        return this.invalidItemKey(payload.item.key);
      }

      await this.magentoApi.removeCartItem(payload.cart.key, itemId);
      return await this.respondReleasingEmptyCart(payload.cart.key);
    } catch (err) {
      return handleMagentoProviderError('remove item from cart', err, payload.cart);
    }
  }

  @Reactionary({
    inputSchema: CartMutationItemQuantityChangeSchema,
    outputSchema: CartSchema,
  })
  public override async changeQuantity(
    payload: CartMutationItemQuantityChange,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const itemId = this.parseItemId(payload.item.key);
      if (itemId === undefined) {
        return this.invalidItemKey(payload.item.key);
      }

      await this.magentoApi.updateCartItem(payload.cart.key, itemId, {
        item_id: itemId,
        qty: payload.quantity,
      });

      return await this.respondReleasingEmptyCart(payload.cart.key);
    } catch (err) {
      return handleMagentoProviderError('change cart item quantity', err, payload.cart);
    }
  }

  @Reactionary({
    outputSchema: CartIdentifierSchema,
  })
  public override async getActiveCartId(): Promise<
    Result<CartIdentifier, NotFoundError>
  > {
    try {
      const activeCartKey = await this.resolveActiveCartKey();

      if (activeCartKey) {
        return success(
          MagentoCartIdentifierSchema.parse({
            key: activeCartKey,
          }),
        );
      }

      return error<NotFoundError>({
        type: 'NotFound',
        identifier: undefined,
      });
    } catch (err) {
      return handleMagentoProviderError('get active cart id', err);
    }
  }

  /**
   * Deletes the cart. Magento has no storefront call to delete a quote, so the
   * quote is emptied and released from the session. A customer quote is only
   * touched when it is the cart asked for: `carts/mine` answers for any key.
   */
  @Reactionary({
    inputSchema: CartMutationDeleteCartSchema,
    outputSchema: z.void(),
  })
  public override async deleteCart(
    payload: CartMutationDeleteCart,
  ): Promise<Result<void>> {
    try {
      const key = payload.cart.key;
      if (!key) {
        return success(undefined);
      }

      const cart = await this.getCartOrUndefined(key);
      if (cart && resolveMagentoCartKey({ ...cart, _requestedId: key }) === key) {
        for (const item of cart.items ?? []) {
          await this.magentoApi.removeCartItem(key, item.item_id);
        }
      }

      await this.forgetCart(key);
      return success(undefined);
    } catch (err) {
      return handleMagentoProviderError('delete cart', err, payload.cart);
    }
  }

  @Reactionary({
    inputSchema: CartMutationApplyCouponSchema,
    outputSchema: CartSchema,
  })
  public override async applyCouponCode(
    payload: CartMutationApplyCoupon,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      await this.magentoApi.applyCoupon(payload.cart.key, payload.couponCode);
      return await this.respondWithCart(payload.cart.key);
    } catch (err) {
      return handleMagentoProviderError('apply coupon', err, payload.cart);
    }
  }

  /**
   * Removes the coupon. A quote holds at most one coupon and Magento's call
   * removes whichever is applied, so a different (or no) applied coupon
   * leaves the cart unchanged.
   */
  @Reactionary({
    inputSchema: CartMutationRemoveCouponSchema,
    outputSchema: CartSchema,
  })
  public override async removeCouponCode(
    payload: CartMutationRemoveCoupon,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const data = await this.fetchCartData(payload.cart.key);
      const applied = data.coupon_code;
      if (!applied || applied.toLowerCase() !== payload.couponCode.toLowerCase()) {
        return success(this.factory.parseCart(this.context, data));
      }

      await this.magentoApi.removeCoupon(payload.cart.key);
      return await this.respondWithCart(payload.cart.key);
    } catch (err) {
      return handleMagentoProviderError('remove coupon', err, payload.cart);
    }
  }

  /**
   * Magento binds a quote's currency to its store view: it cannot be changed
   * on the cart. Asking for the currency the cart already has returns the
   * cart; any other currency is rejected as invalid input.
   */
  @Reactionary({
    inputSchema: CartMutationChangeCurrencySchema,
    outputSchema: CartSchema,
  })
  public override async changeCurrency(
    payload: CartMutationChangeCurrency,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const data = await this.fetchCartData(payload.cart.key);
      const current =
        data.quote_currency_code || data.currency?.quote_currency_code;

      if (current === payload.newCurrency) {
        return success(this.factory.parseCart(this.context, data));
      }

      return error<InvalidInputError>({
        type: 'InvalidInput',
        error: `Magento binds the cart currency to the store view: the cart is in ${current ?? 'an unknown currency'} and cannot be changed to ${payload.newCurrency}. Switch the store view instead.`,
      });
    } catch (err) {
      return handleMagentoProviderError('change cart currency', err, payload.cart);
    }
  }

  /**
   * Magento keeps one active quote per shopper, so the list holds the active
   * cart at most. Like other providers, a search without a company lists the
   * carts that were not created for a company, and a company search lists
   * only that company's carts.
   */
  @Reactionary({
    inputSchema: CartQueryListSchema,
    outputSchema: CartPaginatedSearchResultSchema,
  })
  public override async listCarts(
    payload: CartQueryList,
  ): Promise<Result<CartPaginatedSearchResult>> {
    try {
      const carts: MagentoCartData[] = [];
      const activeCartKey = await this.resolveActiveCartKey();

      if (activeCartKey) {
        const data = await this.fetchCartDataOrUndefined(activeCartKey);
        if (data && this.matchesCompany(data._company, payload.search.company)) {
          carts.push(data);
        }
      }

      const { pageNumber, pageSize } = payload.search.paginationOptions;
      const offset = (pageNumber - 1) * pageSize;

      return success(
        this.factory.parseCartPaginatedSearchResult(
          this.context,
          {
            items: carts.slice(offset, offset + pageSize),
            totalCount: carts.length,
          },
          payload,
        ),
      );
    } catch (err) {
      return handleMagentoProviderError('list carts', err, payload.search);
    }
  }

  /**
   * Creates a cart and makes it the active one. The name and company are kept
   * in the session, as a Magento quote has no field for them. Note that for a
   * signed-in customer Magento returns the existing active quote, if any.
   */
  @Reactionary({
    inputSchema: CartMutationCreateCartSchema,
    outputSchema: CartSchema,
  })
  public override async createCart(
    payload: CartMutationCreateCart,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const { key } = await this.createNewCart();

      if (payload.name !== undefined) {
        await this.magentoApi.setSessionItem(`${CART_NAME_SESSION_PREFIX}${key}`, payload.name);
      }
      if (payload.company) {
        await this.magentoApi.setSessionItem(
          `${CART_COMPANY_SESSION_PREFIX}${key}`,
          JSON.stringify(payload.company),
        );
      }

      return await this.respondWithCart(key);
    } catch (err) {
      return handleMagentoProviderError('create cart', err);
    }
  }

  /** Magento quotes have no name field, so the name is kept in the session. */
  @Reactionary({
    inputSchema: CartMutationRenameCartSchema,
    outputSchema: CartSchema,
  })
  public override async renameCart(
    payload: CartMutationRenameCart,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    try {
      const data = await this.fetchCartData(payload.cart.key);
      await this.magentoApi.setSessionItem(
        `${CART_NAME_SESSION_PREFIX}${resolveMagentoCartKey(data)}`,
        payload.newName,
      );

      return success(
        this.factory.parseCart(this.context, { ...data, name: payload.newName }),
      );
    } catch (err) {
      return handleMagentoProviderError('rename cart', err, payload.cart);
    }
  }

  protected async createNewCart(): Promise<CartIdentifier> {
    const cartId = await this.magentoApi.createCart();
    const identifier = MagentoCartIdentifierSchema.parse({
      key: cartId.replace(/^"|"$/g, ''),
    });

    await this.magentoApi.setActiveCartId(identifier.key);

    return identifier;
  }

  /**
   * The active cart: the one in the session, else, for a signed-in customer,
   * the customer's active Magento quote (which then becomes the session's).
   */
  protected async resolveActiveCartKey(): Promise<string | null> {
    const sessionCartKey = await this.magentoApi.getActiveCartId();
    if (sessionCartKey) {
      return sessionCartKey;
    }

    if (!(await this.magentoApi.getCustomerToken())) {
      return null;
    }

    const cart = await this.getCartOrUndefined(null);
    if (!cart) {
      return null;
    }

    const key = resolveMagentoCartKey(cart);
    await this.magentoApi.setActiveCartId(key);
    return key;
  }

  /**
   * Drops the session's references to a cart: the active cart marker (only
   * when it points at this cart) and its stored name and company.
   */
  protected async forgetCart(key: string): Promise<void> {
    const activeCartKey = await this.magentoApi.getActiveCartId();
    if (activeCartKey === key) {
      await this.magentoApi.clearActiveCartId();
    }
    await this.magentoApi.removeSessionItem(`${CART_NAME_SESSION_PREFIX}${key}`);
    await this.magentoApi.removeSessionItem(`${CART_COMPANY_SESSION_PREFIX}${key}`);
  }

  protected async respondReleasingEmptyCart(
    key: string,
  ): Promise<Result<CartFactoryCartOutput<TFactory>>> {
    const data = await this.fetchCartData(key);
    if ((data.items ?? []).length === 0) {
      debug('Cart %s is empty, releasing it from the session', key);
      await this.forgetCart(key);
    }
    return success(this.factory.parseCart(this.context, data));
  }

  protected matchesCompany(
    cartCompany: CompanyIdentifier | undefined,
    filter: CompanyIdentifier | undefined,
  ): boolean {
    if (!filter) {
      return !cartCompany;
    }
    return cartCompany?.taxIdentifier === filter.taxIdentifier;
  }

  /** Magento cart item ids are integers. */
  protected parseItemId(key: string): number | undefined {
    const itemId = Number(key);
    return key !== '' && Number.isInteger(itemId) ? itemId : undefined;
  }

  protected invalidItemKey(key: string): Result<CartFactoryCartOutput<TFactory>> {
    return error<InvalidInputError>({
      type: 'InvalidInput',
      error: `Invalid Magento cart item key: "${key}"`,
    });
  }

  protected async getCartOrUndefined(key: string | null) {
    try {
      return await this.magentoApi.getCart(key);
    } catch (err) {
      if (isMagentoNotFoundError(err)) {
        return undefined;
      }
      throw err;
    }
  }

  protected async fetchCartDataOrUndefined(
    key: string,
  ): Promise<MagentoCartData | undefined> {
    try {
      return await this.fetchCartData(key);
    } catch (err) {
      if (isMagentoNotFoundError(err)) {
        return undefined;
      }
      throw err;
    }
  }

  /**
   * The cart with merged totals and the session-kept name and company, ready
   * for the factory.
   */
  protected async fetchCartData(key: string): Promise<MagentoCartData> {
    const data: MagentoCartData = {
      ...(await this.getCartWithTotals(key)),
      _requestedId: key,
    };
    const cartKey = resolveMagentoCartKey(data);
    const [name, company] = await Promise.all([
      this.magentoApi.getSessionItem(`${CART_NAME_SESSION_PREFIX}${cartKey}`),
      this.magentoApi.getSessionItem(`${CART_COMPANY_SESSION_PREFIX}${cartKey}`),
    ]);

    if (name !== null) {
      data.name = name;
    }
    data._company = readStoredCompany(company);
    return data;
  }

  /**
   * The cart merged with its totals. A failure of either call propagates:
   * a cart without totals would report zero prices.
   */
  protected async getCartWithTotals(cartId: string): Promise<MagentoCartData> {
    const [cartResponse, totalsResponse] = await Promise.all([
      this.magentoApi.getCart(cartId),
      this.magentoApi.getCartTotals(cartId),
    ]);

    return {
      ...cartResponse,
      ...totalsResponse,
      items: (cartResponse.items || []).map((item) => {
        const totalItem = (totalsResponse.items || []).find(
          (t) => t.item_id === item.item_id,
        );
        return { ...item, ...totalItem };
      }),
    };
  }
}
