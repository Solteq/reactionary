import {
  PriceCapability,
  PriceSchema,
  CustomerPriceQuerySchema,
  ListPriceQuerySchema,
  Reactionary,
  success,
  type Cache,
  type CustomerPriceQuery,
  type ListPriceQuery,
  type PriceFactory,
  type PriceFactoryOutput,
  type PriceFactoryWithOutput,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import type { MagentoClient } from '../core/client.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoPriceFactory } from '../factories/price/price.factory.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:magento:price');

export class MagentoPriceCapability<
  TFactory extends PriceFactory = MagentoPriceFactory,
> extends PriceCapability<PriceFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: PriceFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
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
    const sku = payload.variant.sku;
    try {
      const client = await this.magentoApi.getClient();
      const product = await client.store.product.getBySKU(sku);

      return success(
        this.factory.parsePrice(this.context, { product, sku, mode: 'list' }),
      );
    } catch (e) {
      debug(`Error fetching list price for ${sku}`, e);
      return success(this.createEmptyPriceResult(sku));
    }
  }

  @Reactionary({
    inputSchema: CustomerPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getCustomerPrice(
    payload: CustomerPriceQuery,
  ): Promise<Result<PriceFactoryOutput<TFactory>>> {
    const sku = payload.variant.sku;
    try {
      const client = await this.magentoApi.getClient();
      const product = await client.store.product.getBySKU(sku);

      return success(
        this.factory.parsePrice(this.context, { product, sku, mode: 'customer' }),
      );
    } catch (e) {
      debug(`Error fetching customer price for ${sku}`, e);
      return success(this.createEmptyPriceResult(sku));
    }
  }
}
