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
import type { HclPriceFactory } from '../factories/price/price.factory.js';
import type { HclEntitledPriceResponse } from '../schema/hcl.schema.js';

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
    // In HCL Commerce the public catalogue price rule is always named
    // 'List Price Rule'. We use the entitled-price endpoint which honours
    // that rule automatically for anonymous sessions.
    return this.fetchEntitledPrice(payload.variant.sku);
  }

  @Reactionary({
    inputSchema: CustomerPriceQuerySchema,
    outputSchema: PriceSchema,
  })
  public override async getCustomerPrice(
    payload: CustomerPriceQuery,
  ): Promise<Result<PriceFactoryOutput<TFactory>>> {
    // The entitled-price endpoint (/price?q=byPartNumbers) automatically
    // applies the session's organisation contract for authenticated B2B users,
    // so no explicit price-rule ID is required here.
    return this.fetchEntitledPrice(payload.variant.sku);
  }

  /**
   * Fetch the entitled price for a single SKU.
   *
   * Calls GET /price?q=byPartNumbers&partNumber={sku}[&currency=X]
   *
   * The URL and query-parameter logic lives here (not in the transaction
   * client) so that project-level subclasses can override this method to add
   * extra parameters, switch endpoints, or apply custom logic.
   */
  protected async fetchEntitledPrice(
    sku: string,
  ): Promise<Result<PriceFactoryOutput<TFactory>>> {
    const params = new URLSearchParams();
    params.set('q', 'byPartNumbers');
    params.append('partNumber', sku);

    const response = await this.client.callGet<HclEntitledPriceResponse>(
      `${this.client.transactionBaseUrl}/price`,
      params,
    );

    const rawItem = response.EntitledPrice?.find((i) => i.partNumber === sku);

    if (!rawItem) {
      // Return a zero/empty placeholder consistent with PriceCapability semantics.
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
