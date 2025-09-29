import {
  Inventory,
  InventoryProvider,
  InventoryQuery,
  Session, RequestContext,
  Cache,
  LanguageContext,
} from '@reactionary/core';
import z from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { CommercetoolsClient } from '../core/client';
import { InventoryEntry as CTInventory } from '@commercetools/platform-sdk';
export class CommercetoolsInventoryProvider<
  T extends Inventory = Inventory
> extends InventoryProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache
  ) {
    super(schema, cache);

    this.config = config;
  }

  protected async getClient(reqCtx: RequestContext) {

    const client = await new CommercetoolsClient(this.config).getClient(
      reqCtx
    );
    return client.withProjectKey({ projectKey: this.config.projectKey }).inventory();
  }



  public override async getBySKU(
    payload: InventoryQuery,
    reqCtx: RequestContext
  ): Promise<T> {
    const client = await new CommercetoolsClient(this.config).getClient(reqCtx);

    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .inventory()
      .get({
        queryArgs: {
          where: `sku=${payload.sku}`,
        },
      })
      .execute();

    return this.parseSingle(remote.body, reqCtx);
  }

  protected override parseSingle(_body: unknown, reqCtx: RequestContext): T {
      const body = _body as CTInventory;
      const model = this.newModel();

      model.identifier = {
        sku: { key: body.sku },
        channelId: {
          key: body.supplyChannel?.id || 'online'
        },
      };
      model.sku = body.sku;
      model.quantity = body.availableQuantity;

      if (model.quantity > 0 ) {
        model.status = 'inStock';
      } else {
        model.status = 'outOfStock';
      }

      model.meta = {
        cache: { hit: false, key: this.generateCacheKeySingle(model.identifier, reqCtx) },
        placeholder: false
      };

      return this.assert(model);
  }


}
