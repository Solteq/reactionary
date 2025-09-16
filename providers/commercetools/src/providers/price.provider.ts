import { Price, PriceProvider, PriceQueryBySku, Session, Cache, Currency } from '@reactionary/core';
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

  public override async getBySKU(
    payload: PriceQueryBySku,
    session: Session
  ): Promise<T> {
    const client = new CommercetoolsClient(this.config).getClient(
      session.identity?.token
    );

    //  AND (validFrom is not defined OR validFrom <= now()) AND (validUntil is not defined OR validUntil >= now())
    const queryArgs = {
      where: 'sku=:sku AND currencyCode=:currency',
      'var.sku': payload.sku.key,
      'var.currency': session.languageContext.currencyCode,
    };

    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .standalonePrices()
      .get({
        queryArgs,
      })
      .execute();


      let resultValue: Partial<CTPrice> = {
          sku: payload.sku.key,
          value: {
            centAmount: -1,
            currencyCode: session.languageContext.currencyCode,
            fractionDigits: 0,
            type: 'centPrecision'
          },
          id: 'placeholder',
          key: 'placeholder',
        }

      const matched = remote.body.results.filter(x => x.value.currencyCode === session.languageContext.currencyCode);
      if (matched && matched.length > 0) {
        resultValue = matched[0];
      }
      return this.parseSingle(resultValue, session);

  }

  protected override parseSingle(_body: unknown, session: Session): T {
    const body = _body as CTPrice;

    const base = this.newModel();

    base.value = {
      cents: body.value.centAmount,
      currency: body.value.currencyCode as Currency,
    };

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
