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
      const client = await this.medusaApi.getClient();

      const regionId = await this.medusaApi.getActiveRegion()

      const productResponse = await client.store.product.list({
        variants: {
          sku: payload.variant.sku,

        },
        limit: 1,
        region_id: regionId.id,
      });

      if (productResponse.products.length ===   0) {
        return this.createEmptyPriceResult(sku);
      }

      const product = productResponse.products[0];


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
