import {
  CustomerPriceQuerySchema,
  ListPriceQuerySchema,
  PriceProvider,
  type PriceFactory,
  type PriceFactoryOutput,
  type PriceFactoryWithOutput,
  PriceSchema,
  Reactionary,
  success,
} from '@reactionary/core';
import type {
  RequestContext,
  Cache,
  CustomerPriceQuery,
  ListPriceQuery,
  Result,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type {
  ProductVariant as CTProductVariant,
} from '@commercetools/platform-sdk';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsPriceFactory } from '../factories/price/price.factory.js';

export class CommercetoolsPriceProvider<
  TFactory extends PriceFactory = CommercetoolsPriceFactory,
> extends PriceProvider<PriceFactoryOutput<TFactory>> {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: PriceFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: PriceFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: CustomerPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getCustomerPrice(
    payload: CustomerPriceQuery
  ): Promise<Result<PriceFactoryOutput<TFactory>>> {
    const client = await this.getClient();
    let priceChannelId;
    if (this.config.customerPriceChannelKey) {
      priceChannelId = await this.commercetools.resolveChannelIdByKey(this.config.customerPriceChannelKey);
    } else {
      priceChannelId = await this.commercetools.resolveChannelIdByRole('Primary');
    }

    const response = await client
      .productProjections()
      .get({
        queryArgs: {
          staged: false,
          priceCountry: this.context.taxJurisdiction.countryCode,
          priceCustomerGroup: undefined,
          priceChannel: priceChannelId,
          priceCurrency: this.context.languageContext.currencyCode,
          where: 'variants(sku in (:skus)) OR (masterVariant(sku in (:skus))) ',
          'var.skus': [payload.variant.sku],
          limit: 1,
        },
      })
      .execute();

    const result = response.body.results[0];
    const sku = [result.masterVariant, ...result.variants].find(
      (x) => x.sku === payload.variant.sku
    );

    return success(this.factory.parsePrice(this.context, sku, { includeDiscounts: true }));
  }

  @Reactionary({
    inputSchema: ListPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getListPrice(payload: ListPriceQuery): Promise<Result<PriceFactoryOutput<TFactory>>> {
    const client = await this.getClient();
    let priceChannelId;
    if (this.config.listPriceChannelKey) {
      priceChannelId = await this.commercetools.resolveChannelIdByKey(this.config.listPriceChannelKey);
    } else {
      priceChannelId = await this.commercetools.resolveChannelIdByRole('Primary');
    }
    const response = await client
      .productProjections()
      .get({
        queryArgs: {
          staged: false,
          priceCountry: this.context.taxJurisdiction.countryCode,
          priceCustomerGroup: undefined,
          priceChannel: priceChannelId,
          priceCurrency: this.context.languageContext.currencyCode,
          where: 'variants(sku in (:skus)) OR (masterVariant(sku in (:skus))) ',
          'var.skus': [payload.variant.sku],
          limit: 1,
        },
      })
      .execute();

    const result = response.body.results[0];
    const sku = [result.masterVariant, ...result.variants].find(
      (x) => x.sku === payload.variant.sku
    );

    return success(this.factory.parsePrice(this.context, sku));
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  protected async getChannels() {
    const adminClient = await this.commercetools.getAdminClient();

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
      list: listChannel.body.id,
    };
  }
}
