import { Price, PriceProvider, PriceQueryBySku, Session, Cache, Currency, TieredPriceSchema, MonetaryAmountSchema, TieredPrice } from '@reactionary/core';
import z from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { CommercetoolsClient } from '../core/client';
import { StandalonePrice as CTPrice } from '@commercetools/platform-sdk';
export class CommercetoolsPriceProvider<
  T extends Price = Price
> extends PriceProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  public getClient(session: Session) {
    return new CommercetoolsClient(this.config).getClient(session.identity?.token).withProjectKey({ projectKey: this.config.projectKey }).standalonePrices();
  }


  public override async getBySKUs(payload: PriceQueryBySku[], session: Session): Promise<T[]> {

    const client = this.getClient(session);

    //  AND (validFrom is not defined OR validFrom <= now()) AND (validUntil is not defined OR validUntil >= now())
    const queryArgs = {
      where: 'sku in (:skus)',
      'var.skus': payload.map(p => p.sku.key),
    };


    const response = await client.get({
      queryArgs,
    }).execute();

    const result = [];
    for(const p of payload) {
      const matched = response.body.results.filter(x => x.sku === p.sku.key && x.value.currencyCode === session.languageContext.currencyCode);
      if (matched && matched.length > 0) {
        result.push(this.parseSingle(matched[0], session));
      } else {
        result.push(this.getEmptyPriceResult(p.sku.key, session.languageContext.currencyCode ));
      }
    }

    return result;
  }


  public override async getBySKU(
    payload: PriceQueryBySku,
    session: Session
  ): Promise<T> {
    const client = this.getClient(session);
    //  AND (validFrom is not defined OR validFrom <= now()) AND (validUntil is not defined OR validUntil >= now())
    const queryArgs = {
      where: 'sku=:sku',
      'var.sku': payload.sku.key,
    };

    const remote = await client
      .get({
        queryArgs,
      })
      .execute();


      const matched = remote.body.results.filter(x => x.value.currencyCode === session.languageContext.currencyCode);
      if (matched && matched.length > 0) {
        return this.parseSingle(matched[0], session);
      }
      return this.getEmptyPriceResult(payload.sku.key, session.languageContext.currencyCode );
  }



  protected override parseSingle(_body: unknown, session: Session): T {
    const body = _body as CTPrice;

    const base = this.newModel();

    base.unitPrice = {
      value: (body.value.centAmount / 100),
      currency: body.value.currencyCode as Currency,
    };

    if (body.tiers && body.tiers.length > 0) {
      const p  = body.tiers.map(x => {
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
        key: body.sku
      }
    };

    base.meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(base.identifier, session) },
      placeholder: false
    };

    return this.assert(base);

  }


}
