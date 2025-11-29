import {
  CustomerPriceQuerySchema,
  ListPriceQuerySchema,
  PriceProvider,
  PriceSchema,
  Reactionary,
  TieredPriceSchema,
} from '@reactionary/core';
import type {
  RequestContext,
  Price,
  Cache,
  Currency,
  TieredPrice,
  CustomerPriceQuery,
  ListPriceQuery,
  PriceIdentifier,
  MonetaryAmount,
  Meta,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type {
  Price as CTPrice,
  ProductVariant as CTProductVariant,
} from '@commercetools/platform-sdk';
import type { CommercetoolsClient } from '../core/client.js';
import type z from 'zod';

export class CommercetoolsPriceProvider extends PriceProvider {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(cache, context);

    this.config = config;
    this.client = client;
  }

  @Reactionary({
    inputSchema: CustomerPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getCustomerPrice(
    payload: CustomerPriceQuery
  ): Promise<Price> {
    const client = await this.getClient();
    const priceChannelId = 'ee6e75e9-c9ab-4e2f-85f1-d8c734d0cb86';

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

    return this.parseSingle(sku, { includeDiscounts: true });
  }

  @Reactionary({
    inputSchema: ListPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getListPrice(payload: ListPriceQuery): Promise<Price> {
    const client = await this.getClient();
    const priceChannelId = 'ee6e75e9-c9ab-4e2f-85f1-d8c734d0cb86';

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

    return this.parseSingle(sku);
  }

  protected async getClient() {
    const client = await this.client.getClient();
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  protected parseSingle(
    _body: unknown,
    options = { includeDiscounts: false }
  ): Price {
    const body = _body as CTProductVariant;
    const price = body.price as CTPrice | undefined;

    if (!price) {
      return this.createEmptyPriceResult(body.sku!);
    }

    let unitPrice = {
      value: price.value.centAmount / 100,
      currency: price.value.currencyCode as Currency,
    } satisfies MonetaryAmount;

    if (options.includeDiscounts) {
      const discountedPrice = price.discounted?.value || price.value;

      unitPrice = {
        value: discountedPrice.centAmount / 100,
        currency: price.value.currencyCode as Currency,
      } satisfies MonetaryAmount;
    }

    const identifier = {
      variant: {
        sku: body.sku!,
      },
    } satisfies PriceIdentifier;

    const meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(identifier) },
      placeholder: false,
    } satisfies Meta;

    const result = {
      identifier,
      meta,
      tieredPrices: [],
      unitPrice,
    } satisfies Price;

    return result;
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
      list: listChannel.body.id,
    };
  }
}
