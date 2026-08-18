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
  type Result,
} from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import { SESSION_KEY_PRICE_RULE_ID } from '../core/session-keys.js';
import type { HclPriceFactory } from '../factories/price/price.factory.js';
import type {
  HclEntitledPriceResponse,
  HclDisplayPriceResponse,
} from '../schema/hcl.schema.js';

export class HclPriceCapability<
  TFactory extends PriceFactory = HclPriceFactory,
> extends PriceCapability<PriceFactoryOutput<TFactory>> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly client: HclClient,
    protected readonly factory: PriceFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
  }

  @Reactionary({
    inputSchema: ListPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getListPrice(
    payload: ListPriceQuery,
  ): Promise<Result<PriceFactoryOutput<TFactory>>> {
    const sku = payload.variant.sku;
    const priceRuleId = this.context.session[SESSION_KEY_PRICE_RULE_ID] as
      | string
      | undefined;

    if (!priceRuleId) {
      // display_price requires a priceRuleId — fall back to entitled price.
      const response = await this.client.callGet<HclEntitledPriceResponse>(
        this.getCustomerPriceUrl(),
        this.getCustomerPricePayload(sku),
      );
      const rawItem = response.EntitledPrice?.find((i) => i.partNumber === sku);
      if (!rawItem) {
        return success(
          this.factory.parsePrice(this.context, {
            item: { partNumber: sku },
          }) as PriceFactoryOutput<TFactory>,
        );
      }
      return success(
        this.factory.parsePrice(this.context, {
          item: rawItem,
        }) as PriceFactoryOutput<TFactory>,
      );
    }

    const response = await this.client.callGet<HclDisplayPriceResponse>(
      this.getListPriceUrl(),
      this.getListPricePayload(sku, priceRuleId),
    );

    const rawItem = response.resultList?.find((i) => i.partNumber === sku);

    if (!rawItem) {
      return success(
        this.factory.parsePrice(this.context, {
          item: { partNumber: sku },
        }) as PriceFactoryOutput<TFactory>,
      );
    }

    return success(
      this.factory.parsePrice(this.context, {
        item: rawItem,
      }) as PriceFactoryOutput<TFactory>,
    );
  }

  @Reactionary({
    inputSchema: CustomerPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getCustomerPrice(
    payload: CustomerPriceQuery,
  ): Promise<Result<PriceFactoryOutput<TFactory>>> {
    const sku = payload.variant.sku;
    const response = await this.client.callGet<HclEntitledPriceResponse>(
      this.getCustomerPriceUrl(),
      this.getCustomerPricePayload(sku),
    );
    const rawItem = response.EntitledPrice?.find((i) => i.partNumber === sku);
    if (!rawItem) {
      return success(
        this.factory.parsePrice(this.context, {
          item: { partNumber: sku },
        }) as PriceFactoryOutput<TFactory>,
      );
    }
    return success(
      this.factory.parsePrice(this.context, {
        item: rawItem,
      }) as PriceFactoryOutput<TFactory>,
    );
  }

  protected getListPriceUrl(): string {
    return `${this.client.transactionBaseUrl}/display_price`;
  }

  protected getListPricePayload(
    sku: string,
    priceRuleId: string,
  ): URLSearchParams {
    const params = new URLSearchParams();
    params.set('q', 'byPartNumbersAndPriceRuleId');
    params.set('priceRuleId', priceRuleId);
    params.append('partNumber', sku);
    return params;
  }

  protected getCustomerPriceUrl(): string {
    return `${this.client.transactionBaseUrl}/price`;
  }

  protected getCustomerPricePayload(sku: string): URLSearchParams {
    const params = new URLSearchParams();
    params.set('q', 'byPartNumbers');
    params.append('partNumber', sku);
    return params;
  }
}
