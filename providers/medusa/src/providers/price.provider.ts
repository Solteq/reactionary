import type { StoreProductVariant } from '@medusajs/types';
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
  type Result
} from '@reactionary/core';
import createDebug from 'debug';
import type z from 'zod';
import type { MedusaClient } from '../core/client.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

const debug = createDebug('reactionary:medusa:price');

export class MedusaPriceProvider extends PriceProvider {
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
    inputSchema: ListPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getListPrice(payload: ListPriceQuery): Promise<Result<Price>> {
    const result = await this.getBySKU(payload);

    return success(result);
  }

  @Reactionary({
    inputSchema: CustomerPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getCustomerPrice(payload: CustomerPriceQuery): Promise<Result<Price>> {
    const result = await this.getBySKU(payload);

    return success(result);
  }


  protected async getBySKU(payload: ListPriceQuery | CustomerPriceQuery ): Promise<Price> {
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

  protected parseSingle(variant: StoreProductVariant): Price {
    const identifier = {
      variant: {
        sku: variant.sku || '',
      },
    } satisfies PriceIdentifier;

    // In Medusa v2, calculated_price contains the final price for the variant
    // based on the region, currency, and any applicable price lists
    const calculatedPrice = variant.calculated_price;

    let unitPrice;
    if (calculatedPrice) {
      unitPrice = {
        value: calculatedPrice.calculated_amount || 0,
        currency: (calculatedPrice.currency_code?.toUpperCase() ||
          this.context.languageContext.currencyCode) as Currency,
      } satisfies MonetaryAmount;
    } else {
      // Fallback to empty price if no calculated price available
      unitPrice = {
        value: -1,
        currency: this.context.languageContext.currencyCode as Currency,
      } satisfies MonetaryAmount;
    }

    const result = {
      identifier,
      tieredPrices: [],
      unitPrice
    } satisfies Price;

    return result;
  }


  protected override getResourceName(): string {
    return 'price';
  }
}
