import { PriceProvider, TieredPriceSchema } from '@reactionary/core';
import type { PriceQueryBySku, RequestContext , Price, Cache, Currency, TieredPrice } from '@reactionary/core';
import type z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { CommercetoolsClient } from '../core/client';
import type { Price as CTPrice, ProductVariant as CTProductVariant } from '@commercetools/platform-sdk';
export class CommercetoolsPriceProvider<
  T extends Price = Price
> extends PriceProvider<T> {
  protected config: CommercetoolsConfiguration;



  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }


  protected async getClient(reqCtx: RequestContext) {
    const client = await new CommercetoolsClient(this.config).getClient(
      reqCtx
    );
    return client.withProjectKey({ projectKey: this.config.projectKey }).productProjections()
  }



  public override async getBySKUs(payload: PriceQueryBySku[], reqCtx: RequestContext): Promise<T[]> {

    const client = await this.getClient(reqCtx);

    //  AND (validFrom is not defined OR validFrom <= now()) AND (validUntil is not defined OR validUntil >= now())

    const channels = await this.getChannels(reqCtx);

    const response = await client.get({
      queryArgs: {
        staged: false,
        priceCountry: reqCtx.taxJurisdiction.countryCode,
        priceCustomerGroup: undefined,
        priceChannel: channels.offerChannelGUID,
        priceCurrency: reqCtx.languageContext.currencyCode,
       // storeProjection: reqCtx.storeIdentifier?.key || undefined,
        where: 'variants(sku in (:skus)) OR (masterVariant(sku in (:skus))) ',
        'var.skus': payload.map(p => p.sku.key),
        limit: payload.length,
      },
    }).execute();

    const result = [];
    const allReturnedVariants = [...response.body.results.map(x => x.variants).flat(), ...response.body.results.map(x => x.masterVariant).flat()];
    // Now we need to match the skus requested with the prices returned.
    for(const p of payload) {
      const foundSku = allReturnedVariants.find(v => v.sku === p.sku.key);

      if (!foundSku) {
        result.push(this.createEmptyPriceResult(p.sku.key, reqCtx.languageContext.currencyCode ));
      } else {
        result.push(this.parseSingle(foundSku, reqCtx));
      }
    }

    return result;
  }


  public override async getBySKU(
    payload: PriceQueryBySku,
    reqCtx: RequestContext
  ): Promise<T> {
    return this.getBySKUs([payload], reqCtx).then(r => r[0]);
  }



  protected override parseSingle(_body: unknown, reqCtx: RequestContext): T {
    const body = _body as CTProductVariant;
    const price = body.price as CTPrice | undefined;

    if (!price) {
      return this.createEmptyPriceResult(body.sku!, reqCtx.languageContext.currencyCode);
    }

    const base = this.newModel();
    base.unitPrice = {
      value: (price.value.centAmount / 100),
      currency: price.value.currencyCode as Currency,
    };

    if (price.tiers && price.tiers.length > 0) {
      const p  = price.tiers.map(x => {
        const tp: TieredPrice = TieredPriceSchema.parse({});
        tp.minimumQuantity = x.minimumQuantity;
        tp.price = {
          value: (x.value.centAmount / 100),
          currency: x.value.currencyCode as Currency,
        };
        return tp;
      });
      base.tieredPrices = p;
    }

    base.identifier = {
      sku: {
        key: body.sku!
      }
    };

    base.meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(base.identifier, reqCtx) },
      placeholder: false
    };

    return this.assert(base);

  }

  protected async getChannels(reqCtx: RequestContext) {

    if (!(reqCtx.session['commercetools'] && reqCtx.session['commercetools'].offerChannelGUID && reqCtx.session['commercetools'].listChannelGUID)) {

      /**
       * Bah - have to be an admin to call these....
       * So either we cache them in the session, or we make the user provide them in the config.
       */

   /*
        const configClient = await new CommercetoolsClient(this.config).getClient(reqCtx);
        const offerPriceChannelPromise = configClient.withProjectKey({ projectKey: this.config.projectKey }).channels().withKey({ key: 'Offer Price'}).get().execute();
        const listPriceChannelPromise = configClient.withProjectKey({ projectKey: this.config.projectKey }).channels().withKey({ key: 'List Price'}).get().execute();

        const [offerChannel, listChannel] = await Promise.all([offerPriceChannelPromise, listPriceChannelPromise]);
    */

        reqCtx.session['commercetools'] = {
          ...reqCtx.session['commercetools'],
          offerChannelGUID: undefined,
          listChannelGUID: undefined
        };
    }


    return {
      offerChannelGUID: reqCtx.session['commercetools'].offerChannelGUID,
      listChannelGUID: reqCtx.session['commercetools'].listChannelGUID
    }
  }
}
