import {
  CustomerPriceQuerySchema,
  ListPriceQuerySchema,
  PriceCapability,
  PriceSchema,
  Reactionary,
  success,
  type Cache,
  type CustomerPriceQuery,
  type ListPriceQuery,
  type PriceFactory,
  type PriceFactoryOutput,
  type PriceFactoryWithOutput,
  type RequestContext,
  type Result
} from '@reactionary/core';
import createDebug from 'debug';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaPriceFactory } from '../factories/price/price.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

const debug = createDebug('reactionary:medusa:price');

export class MedusaPriceCapability<
  TFactory extends PriceFactory = MedusaPriceFactory,
> extends PriceCapability<PriceFactoryOutput<TFactory>> {
  protected config: MedusaConfiguration;
  protected factory: PriceFactoryWithOutput<TFactory>;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: PriceFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: ListPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getListPrice(
    payload: ListPriceQuery,
  ): Promise<Result<PriceFactoryOutput<TFactory>>> {
    const result = await this.getBySKU(payload, 'list');

    return success(result);
  }

  @Reactionary({
    inputSchema: CustomerPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getCustomerPrice(
    payload: CustomerPriceQuery,
  ): Promise<Result<PriceFactoryOutput<TFactory>>> {
    const result = await this.getBySKU(payload, 'customer');

    return success(result);
  }


  protected async getBySKU(
    payload: ListPriceQuery | CustomerPriceQuery,
    mode: 'list' | 'customer',
  ): Promise<PriceFactoryOutput<TFactory>> {
    const sku = payload.variant.sku;

    if (debug.enabled) {
      debug(`Fetching price for SKU: ${sku}`);
    }

    try {
      const productForSKU = await this.medusaApi.resolveProductForSKU(payload.variant.sku);

      const client = await this.medusaApi.getClient();
      const product = (
        await client.store.product.retrieve(
          productForSKU.id || '',
          { region_id: (await this.medusaApi.getActiveRegion()).id },
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
      return this.factory.parsePrice(this.context, { variant, mode });
    } catch (error) {
      if (debug.enabled) {
        debug(
          `Error fetching price for SKU ${sku}: ${(error as Error).message}`
        );
      }
      return this.createEmptyPriceResult(sku);
    }
  }
}
