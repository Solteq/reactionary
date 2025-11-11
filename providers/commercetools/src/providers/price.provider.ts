import {
  PriceProvider,
  PriceQueryBySkuSchema,
  PriceSchema,
  Reactionary,
  TieredPriceSchema,
} from '@reactionary/core';
import type {
  PriceQueryBySku,
  RequestContext,
  Price,
  Cache,
  Currency,
  TieredPrice,
} from '@reactionary/core';
import z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type {
  Price as CTPrice,
  ProductVariant as CTProductVariant,
} from '@commercetools/platform-sdk';
import type { CommercetoolsClient } from '../core/client.js';
export class CommercetoolsPriceProvider<
  T extends Price = Price
> extends PriceProvider<T> {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(schema, cache, context);

    this.config = config;
    this.client = client;
  }

  protected async getClient() {
    const client = await this.client.getAdminClient();
    return client
      .withProjectKey({ projectKey: this.config.projectKey });
  }

  @Reactionary({
    inputSchema: z.array(PriceQueryBySkuSchema),
    outputSchema: z.array(PriceSchema),
  })
  public override async getBySKUs(payload: PriceQueryBySku[]): Promise<T[]> {
    /**
     * TODO: Decide if we actually want this endpoint. It has the downside, at least for broad use, of being difficult to cache
     */
    throw new Error('Unsupported!');
  }

  @Reactionary({
    inputSchema: PriceQueryBySkuSchema,
    outputSchema: PriceSchema,
  })
  public override async getBySKU(payload: PriceQueryBySku): Promise<T> {
    const client = await this.getClient();

    // FIXME: Data-cache this, or pass it in through config, or something...
    const channels = await this.getChannels();

    const response = await client
      .productProjections()
      .get({
        queryArgs: {
          staged: false,
          priceCountry: this.context.taxJurisdiction.countryCode,
          priceCustomerGroup: undefined,
          // FIXME: Hardcoded value
          priceChannel: 'ee6e75e9-c9ab-4e2f-85f1-d8c734d0cb86',
          priceCurrency: this.context.languageContext.currencyCode,
          where: 'variants(sku in (:skus)) OR (masterVariant(sku in (:skus))) ',
          'var.skus': [payload.variant.sku],
          limit: 1,
        },
      })
      .execute();
    
    const sku = response.body.results[0].masterVariant;

    return this.parseSingle(sku); 
  }

  protected override parseSingle(_body: unknown): T {
    const body = _body as CTProductVariant;
    const price = body.price as CTPrice | undefined;

    if (!price) {
      return this.createEmptyPriceResult(body.sku!);
    }

    const base = this.newModel();
    base.unitPrice = {
      value: price.value.centAmount / 100,
      currency: price.value.currencyCode as Currency,
    };

    if (price.tiers && price.tiers.length > 0) {
      const p = price.tiers.map((x) => {
        const tp: TieredPrice = TieredPriceSchema.parse({});
        tp.minimumQuantity = x.minimumQuantity;
        tp.price = {
          value: x.value.centAmount / 100,
          currency: x.value.currencyCode as Currency,
        };
        return tp;
      });
      base.tieredPrices = p;
    }

    base.identifier = {
      variant: {
        sku: body.sku!,
      },
    };

    base.meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(base.identifier) },
      placeholder: false,
    };

    return this.assert(base);
  }

  protected async getChannels() {
    const adminClient = await this.client.getAdminClient();

    const offerPriceChannelPromise = adminClient
      .withProjectKey({ projectKey: this.config.projectKey })
      .channels()
      .withKey({ key: 'Offer Price' })
      .get()
      .execute();
    const listPriceChannelPromise = adminClient
      .withProjectKey({ projectKey: this.config.projectKey })
      .channels()
      .withKey({ key: 'List Price' })
      .get()
      .execute();

    const [offerChannel, listChannel] = await Promise.all([
      offerPriceChannelPromise,
      listPriceChannelPromise,
    ]);

    return {
      offer: offerChannel.body.id,
      list: listChannel.body.id
    }
  }
}
