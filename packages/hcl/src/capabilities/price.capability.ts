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
import type { HclTransactionClient } from '../core/transaction-client.js';
import type { HclPriceFactory } from '../factories/price/price.factory.js';

export class HclPriceCapability<
  TFactory extends PriceFactory = HclPriceFactory,
> extends PriceCapability<PriceFactoryOutput<TFactory>> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly transactionClient: HclTransactionClient,
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
    return this.fetchPrice(payload.variant.sku);
  }

  @Reactionary({
    inputSchema: CustomerPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getCustomerPrice(
    payload: CustomerPriceQuery,
  ): Promise<Result<PriceFactoryOutput<TFactory>>> {
    // For B2B: treat company.taxIdentifier as the price rule ID (consistent with
    // how contractId is used in product search queries).
    const priceRuleId =
      payload.company?.taxIdentifier ?? this.config.priceRuleId;
    return this.fetchPrice(payload.variant.sku, priceRuleId);
  }

  private async fetchPrice(
    sku: string,
    priceRuleId?: string,
  ): Promise<Result<PriceFactoryOutput<TFactory>>> {
    // When a priceRuleId is known (B2B customer price), use /display_price which
    // supports rule-based pricing. Fall back to /price for anonymous list prices.
    const rawItem = priceRuleId
      ? await this.transactionClient
          .getDisplayPrice([sku], {
            priceRuleId,
            currency: this.config.currency,
          })
          .then((r) => r.resultList?.find((i) => i.partNumber === sku))
      : await this.transactionClient
          .getEntitledPrice([sku], { currency: this.config.currency })
          .then((r) => r.EntitledPrice?.find((i) => i.partNumber === sku));

    if (!rawItem) {
      // Return an empty placeholder price rather than a not-found error —
      // consistent with PriceCapability.createEmptyPriceResult semantics.
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
}
