import {
    PriceProvider,
    PriceSchema,
    CustomerPriceQuerySchema,
    ListPriceQuerySchema,
    Reactionary,
    success,
    type Cache,
    type Currency,
    type CustomerPriceQuery,
    type ListPriceQuery,
    type Price,
    type RequestContext,
    type PriceIdentifier,
    type MonetaryAmount,
    type Result,
    type TieredPrice,
} from '@reactionary/core';
import type { MagentoClient } from '../core/client.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:magento:price');

export class MagentoPriceProvider extends PriceProvider {
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
        inputSchema: ListPriceQuerySchema,
        outputSchema: PriceSchema,
    })
    public override async getListPrice(payload: ListPriceQuery): Promise<Result<Price>> {
        const sku = payload.variant.sku;
        try {
            const client = await this.magentoApi.getClient();
            const product = await client.store.product.getBySKU(sku);

            return success(this.parsePrice(product, sku, 'list'));
        } catch (e: any) {
            debug(`Error fetching list price for ${sku}`, e);
            return success(this.createEmptyPriceResult(sku));
        }
    }

    @Reactionary({
        inputSchema: CustomerPriceQuerySchema,
        outputSchema: PriceSchema,
    })
    public override async getCustomerPrice(payload: CustomerPriceQuery): Promise<Result<Price>> {
        const sku = payload.variant.sku;
        try {
            const client = await this.magentoApi.getClient();
            const product = await client.store.product.getBySKU(sku);

            return success(this.parsePrice(product, sku, 'customer'));
        } catch (e: any) {
            debug(`Error fetching customer price for ${sku}`, e);
            return success(this.createEmptyPriceResult(sku));
        }
    }

    protected parsePrice(product: any, sku: string, type: 'list' | 'customer'): Price {
        const identifier = {
            variant: { sku },
        } satisfies PriceIdentifier;

        const basePrice = Number(product.price || 0);

        // Get special price from custom_attributes
        const specialPriceAttr = (product.custom_attributes || []).find((a: any) => a.attribute_code === 'special_price');
        const specialPrice = specialPriceAttr ? Number(specialPriceAttr.value) : undefined;

        // TODO: add special_from_date and special_to_date for true effective price
        const finalPrice = (type === 'customer' && specialPrice !== undefined) ? specialPrice : basePrice;

        const unitPrice = {
            value: finalPrice,
            currency: (this.context.languageContext.currencyCode || 'USD') as Currency,
        } satisfies MonetaryAmount;

        // Parse tiered prices if available
        const tieredPrices: TieredPrice[] = [];
        if (Array.isArray(product.tier_prices)) {
            for (const tier of product.tier_prices) {
                tieredPrices.push({
                    minimumQuantity: Number(tier.qty),
                    price: {
                        value: Number(tier.value),
                        currency: (this.context.languageContext.currencyCode || 'USD') as Currency,
                    }
                });
            }
        }

        return {
            identifier,
            unitPrice,
            tieredPrices,
        } satisfies Price;
    }
}
