import { PriceProvider, TieredPriceSchema } from '@reactionary/core';
import type { PriceQueryBySku, RequestContext , Price, Cache, Currency, TieredPrice } from '@reactionary/core';
import type z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import { CommercetoolsClient } from '../core/client.js';
import type { Price as CTPrice, ProductVariant as CTProductVariant } from '@commercetools/platform-sdk';
export class CommercetoolsPriceProvider<
  T extends Price = Price
> extends PriceProvider<T> {
  protected config: CommercetoolsConfiguration;



  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, cache: Cache, context: RequestContext) {
    super(schema, cache, context);

    this.config = config;
  }


  protected async getClient() {
    const client = await new CommercetoolsClient(this.config).getClient(
      this.context
    );
    return client.withProjectKey({ projectKey: this.config.projectKey }).productProjections()
  }



  public override async getBySKUs(payload: PriceQueryBySku[]): Promise<T[]> {
    const client = await this.getClient();

    //  AND (validFrom is not defined OR validFrom <= now()) AND (validUntil is not defined OR validUntil >= now())

    const channels = await this.getChannels();

    const response = await client.get({
      queryArgs: {
        staged: false,
        priceCountry: this.context.taxJurisdiction.countryCode,
        priceCustomerGroup: undefined,
        priceChannel: channels.offerChannelGUID,
        priceCurrency: this.context.languageContext.currencyCode,
        where: 'variants(sku in (:skus)) OR (masterVariant(sku in (:skus))) ',
        'var.skus': payload.map(p => p.variant.sku),
        limit: payload.length,
      },
    }).execute();

    const result = [];
    const allReturnedVariants = [...response.body.results.map(x => x.variants).flat(), ...response.body.results.map(x => x.masterVariant).flat()];
    // Now we need to match the skus requested with the prices returned.
    for(const p of payload) {
      const foundSku = allReturnedVariants.find(v => v.sku === p.variant.sku);

      if (!foundSku) {
        result.push(this.createEmptyPriceResult(p.variant.sku));
      } else {
        result.push(this.parseSingle(foundSku));
      }
    }

    return result;
  }


  public override async getBySKU(
    payload: PriceQueryBySku
  ): Promise<T> {
    return this.getBySKUs([payload]).then(r => r[0]);
  }



  protected override parseSingle(_body: unknown): T {
    const body = _body as CTProductVariant;
    const price = body.price as CTPrice | undefined;

    if (!price) {
      return this.createEmptyPriceResult(body.sku!);
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
      variant: {
        sku: body.sku!
      }
    };

    base.meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(base.identifier) },
      placeholder: false
    };

    return this.assert(base);

  }

  protected async getChannels() {
    if (!(this.context.session['commercetools'] && this.context.session['commercetools'].offerChannelGUID && this.context.session['commercetools'].listChannelGUID)) {

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

        this.context.session['commercetools'] = {
          ...this.context.session['commercetools'],
          offerChannelGUID: undefined,
          listChannelGUID: undefined
        };
    }


    return {
      offerChannelGUID: this.context.session['commercetools'].offerChannelGUID,
      listChannelGUID: this.context.session['commercetools'].listChannelGUID
    }
  }
}
