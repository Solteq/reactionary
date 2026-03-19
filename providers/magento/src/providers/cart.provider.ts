import {
    type Cache,
    type Cart,
    type CartIdentifier,
    type CartItem,
    type CartMutationApplyCoupon,
    type CartMutationChangeCurrency,
    type CartMutationDeleteCart,
    type CartMutationItemAdd,
    type CartMutationItemQuantityChange,
    type CartMutationItemRemove,
    type CartMutationRemoveCoupon,
    type CartQueryById,
    type CostBreakDown,
    type Currency,
    type ItemCostBreakdown,
    type NotFoundError,
    type ProductVariantIdentifier,
    type RequestContext,
    type Result,
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
    Reactionary,
    success,
    error,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoClient } from '../core/client.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import { MagentoCartIdentifierSchema, type MagentoCartIdentifier } from '../schema/magento.schema.js';

const debug = createDebug('reactionary:magento:cart');

export class MagentoCartProvider extends CartProvider {
    protected config: MagentoConfiguration;

    constructor(
        config: MagentoConfiguration,
        cache: Cache,
        context: RequestContext,
        public magentoApi: MagentoClient
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
            const magentoId = payload.cart as MagentoCartIdentifier;
            const cartResponse = await this.getCartWithTotals(magentoId.key);

            if (cartResponse) {
                return success(this.parseSingle(cartResponse, magentoId.key));
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

    @Reactionary({
        inputSchema: CartMutationItemAddSchema,
        outputSchema: CartSchema,
    })
    public override async add(
        payload: CartMutationItemAdd
    ): Promise<Result<Cart>> {
        try {
            let cartIdentifier = payload.cart;
            if (!cartIdentifier) {
                // If no cart in payload, try to get active cart or create one
                const activeCart = await this.getActiveCartId();
                if (activeCart.success) {
                    cartIdentifier = activeCart.value;
                } else {
                    cartIdentifier = await this.createCart();
                }
            }

            const magentoId = cartIdentifier as MagentoCartIdentifier;
            const item = {
                sku: payload.variant.sku,
                qty: payload.quantity,
            };

            const response = await this.magentoApi.addItemToCart(magentoId.key, item);

            // Re-fetch the cart to get the updated state
            const cartResponse = await this.getCartWithTotals(magentoId.key);
            return success(this.parseSingle(cartResponse, magentoId.key));
        } catch (err) {
            debug('Failed to add item to cart:', err);
            throw err;
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
            const magentoId = payload.cart as MagentoCartIdentifier;
            await this.magentoApi.removeCartItem(magentoId.key, Number(payload.item.key));

            const cartResponse = await this.getCartWithTotals(magentoId.key);
            return success(this.parseSingle(cartResponse, magentoId.key));
        } catch (err) {
            debug('Failed to remove item from cart:', err);
            throw err;
        }
    }

    @Reactionary({
        inputSchema: CartMutationItemQuantityChangeSchema,
        outputSchema: CartSchema,
    })
    public override async changeQuantity(
        payload: CartMutationItemQuantityChange
    ): Promise<Result<Cart>> {
        try {
            const magentoId = payload.cart as MagentoCartIdentifier;
            const item = {
                item_id: Number(payload.item.key),
                qty: payload.quantity,
            };

            await this.magentoApi.updateCartItem(magentoId.key, Number(payload.item.key), item);

            const cartResponse = await this.getCartWithTotals(magentoId.key);
            return success(this.parseSingle(cartResponse, magentoId.key));
        } catch (err) {
            debug('Failed to change quantity:', err);
            throw err;
        }
    }

    @Reactionary({
        outputSchema: CartIdentifierSchema,
    })
    public override async getActiveCartId(): Promise<
        Result<CartIdentifier, NotFoundError>
    > {
        try {
            const activeCartId = await (this.magentoApi as any).tokenStore.getItem('activeCartId');

            if (activeCartId) {
                return success(
                    MagentoCartIdentifierSchema.parse({
                        key: activeCartId,
                    })
                );
            }

            return error<NotFoundError>({
                type: 'NotFound',
                identifier: undefined,
            });
        } catch (err) {
            return error<NotFoundError>({
                type: 'NotFound',
                identifier: undefined,
            });
        }
    }

    @Reactionary({
        inputSchema: CartMutationDeleteCartSchema,
        outputSchema: CartSchema,
    })
    public override async deleteCart(
        payload: CartMutationDeleteCart
    ): Promise<Result<void>> {
        // Magento doesn't have a direct "delete cart" REST API that is commonly used for guest carts
        await (this.magentoApi as any).tokenStore.removeItem('activeCartId');
        return success(undefined);
    }

    @Reactionary({
        inputSchema: CartMutationApplyCouponSchema,
        outputSchema: CartSchema,
    })
    public override async applyCouponCode(
        payload: CartMutationApplyCoupon
    ): Promise<Result<Cart>> {
        try {
            const magentoId = payload.cart as MagentoCartIdentifier;
            await this.magentoApi.applyCoupon(magentoId.key, payload.couponCode);

            const cartResponse = await this.getCartWithTotals(magentoId.key);
            return success(this.parseSingle(cartResponse, magentoId.key));
        } catch (err) {
            debug('Failed to apply coupon:', err);
            throw err;
        }
    }

    @Reactionary({
        inputSchema: CartMutationRemoveCouponSchema,
        outputSchema: CartSchema,
    })
    public override async removeCouponCode(
        payload: CartMutationRemoveCoupon
    ): Promise<Result<Cart>> {
        try {
            const magentoId = payload.cart as MagentoCartIdentifier;
            await this.magentoApi.removeCoupon(magentoId.key);

            const cartResponse = await this.getCartWithTotals(magentoId.key);
            return success(this.parseSingle(cartResponse, magentoId.key));
        } catch (err) {
            debug('Failed to remove coupon:', err);
            throw err;
        }
    }

    @Reactionary({
        inputSchema: CartMutationChangeCurrencySchema,
        outputSchema: CartSchema,
    })
    public override async changeCurrency(
        _payload: CartMutationChangeCurrency
    ): Promise<Result<Cart>> {
        throw new Error('Currency change not implemented for Magento');
    }

    protected async createCart(): Promise<CartIdentifier> {
        const cartId = await this.magentoApi.createCart();
        const identifier = MagentoCartIdentifierSchema.parse({
            key: cartId.replace(/^"|"$/g, ''),
        });

        await (this.magentoApi as any).tokenStore.setItem('activeCartId', identifier.key);

        return identifier;
    }

    protected async getCartWithTotals(cartId: string): Promise<any> {
        try {
            const [cartResponse, totalsResponse] = await Promise.all([
                this.magentoApi.getCart(cartId),
                this.magentoApi.getCartTotals(cartId)
            ]);

            return {
                ...cartResponse,
                ...totalsResponse,
                items: (cartResponse.items || []).map((item: any) => {
                    const totalItem = (totalsResponse.items || []).find((t: any) => t.item_id === item.item_id);
                    return { ...item, ...totalItem };
                })
            };
        } catch (err) {
            debug('Failed to get cart with totals:', err);
            // Fallback to just getCart if totals fails for some reason
            return this.magentoApi.getCart(cartId);
        }
    }

    protected parseSingle(remote: any, requestedId?: string): Cart {
        const currency = (remote.quote_currency_code || 'USD') as Currency;

        const cost: CostBreakDown = {
            totalProductPrice: {
                value: remote.subtotal || remote.base_subtotal || 0,
                currency,
            },
            grandTotal: {
                value: remote.grand_total || remote.base_grand_total || 0,
                currency,
            },
            totalTax: {
                value: remote.tax_amount || remote.base_tax_amount || 0,
                currency,
            },
            totalShipping: {
                value: remote.shipping_amount || remote.base_shipping_amount || 0,
                currency,
            },
            totalDiscount: {
                value: Math.abs(remote.discount_amount || remote.base_discount_amount || 0),
                currency,
            },
            totalSurcharge: {
                value: 0,
                currency,
            }
        };

        const items = (remote.items || []).map((item: any) => this.parseCartItem(item, currency));

        let identifierKey = remote.masked_id;
        if (!identifierKey && requestedId && isNaN(Number(requestedId))) {
            identifierKey = requestedId;
        }
        if (!identifierKey) {
            identifierKey = remote.id;
        }

        return {
            identifier: {
                key: String(identifierKey || ''),
            },
            userId: {
                userId: String(remote.customer?.id || ''),
            },
            items,
            price: cost,
            name: remote.name || '',
            description: remote.description || '',
        };
    }

    protected parseCartItem(remoteItem: any, currency: Currency): CartItem {
        return {
            identifier: {
                key: String(remoteItem.item_id),
            },
            product: {
                key: remoteItem.sku,
            },
            variant: ProductVariantIdentifierSchema.parse({
                sku: remoteItem.sku,
            }),
            quantity: remoteItem.qty,
            price: {
                unitPrice: {
                    value: remoteItem.price || 0,
                    currency,
                },
                unitDiscount: {
                    value: remoteItem.discount_amount ? Math.abs(remoteItem.discount_amount / (remoteItem.qty || 1)) : 0,
                    currency,
                },
                totalPrice: {
                    value: remoteItem.row_total !== undefined ? remoteItem.row_total : ((remoteItem.price || 0) * (remoteItem.qty || 0)),
                    currency,
                },
                totalDiscount: {
                    value: Math.abs(remoteItem.discount_amount || 0),
                    currency,
                }
            },
        };
    }
}
