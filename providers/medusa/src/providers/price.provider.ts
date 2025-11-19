import type { StoreProductVariant } from '@medusajs/types';
import {
  PriceProvider,
  type Cache,
  type Currency,
  type CustomerPriceQuery,
  type ListPriceQuery,
  type Price,
  type RequestContext
} from '@reactionary/core';
import createDebug from 'debug';
import type z from 'zod';
import type { MedusaClient } from '../core/client.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

const debug = createDebug('reactionary:medusa:price');

export class MedusaPriceProvider<
  T extends Price = Price
> extends PriceProvider<T> {
  protected config: MedusaConfiguration;

  constructor(
    config: MedusaConfiguration,
    schema: z.ZodType<T>,
    cache: Cache,
    context: RequestContext,
    public client: MedusaClient
  ) {
    super(schema, cache, context);
    this.config = config;
  }

  public override getListPrice(payload: ListPriceQuery): Promise<T> {
    return this.getBySKU(payload);
  }

  public override getCustomerPrice(payload: CustomerPriceQuery): Promise<T> {
    return this.getBySKU(payload);
  }


  protected async getBySKU(payload: ListPriceQuery | CustomerPriceQuery ): Promise<T> {
    const sku = payload.variant.sku;

    if (debug.enabled) {
      debug(`Fetching price for SKU: ${sku}`);
    }

    try {
      const productForSKU = await this.client.resolveProductForSKU(payload.variant.sku);

      const client = await this.client.getClient();
      const product = (
        await client.store.product.retrieve(
          productForSKU.id || '',
          { region_id: (await this.client.getActiveRegion()).id }
        )
      ).product;


      const variant = product.variants?.find((v) => v.sku === sku);
      if (!variant) {
        if (debug.enabled) {
          debug(
            `Variant with SKU ${sku} not found in product ${product.id}`
          );
        }
        return this.createEmptyPriceResult(sku);
      }

      // For simplicity, return the first matched product
      return this.parseSingle(variant);
    } catch (error) {
      if (debug.enabled) {
        debug(
          `Error fetching price for SKU ${sku}: ${(error as Error).message}`
        );
      }
      return this.createEmptyPriceResult(sku);
    }
  }

  protected override parseSingle(variant: StoreProductVariant): T {
    const model = this.newModel();

    model.identifier = {
      variant: {
        sku: variant.sku || '',
      },
    };

    // In Medusa v2, calculated_price contains the final price for the variant
    // based on the region, currency, and any applicable price lists
    const calculatedPrice = variant.calculated_price;

    if (calculatedPrice) {
      model.unitPrice = {
        value: calculatedPrice.calculated_amount || 0,
        currency: (calculatedPrice.currency_code?.toUpperCase() ||
          this.context.languageContext.currencyCode) as Currency,
      };
    } else {
      // Fallback to empty price if no calculated price available
      model.unitPrice = {
        value: -1,
        currency: this.context.languageContext.currencyCode as Currency,
      };
    }

    // Medusa v2 doesn't have built-in tiered pricing in the same way
    // You would typically implement this through price lists with different price sets
    // For now, we'll leave tiered prices empty
    model.tieredPrices = [];

    model.meta = {
      cache: {
        hit: false,
        key: this.generateCacheKeySingle(model.identifier),
      },
      placeholder: calculatedPrice === undefined,
    };

    return this.assert(model);
  }


  protected override getResourceName(): string {
    return 'price';
  }
}
