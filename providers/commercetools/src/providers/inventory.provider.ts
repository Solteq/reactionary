import {
  Inventory,
  InventoryProvider,
  InventoryQuery,
  Session,
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

  protected getClient(session: Session) {
    const token = session.identity.keyring.find(x => x.service === 'commercetools')?.token;
    const client = new CommercetoolsClient(this.config).getClient(
      token
    );
    return client.withProjectKey({ projectKey: this.config.projectKey }).inventory();
  }



  public override async getBySKU(
    payload: InventoryQuery,
    session: Session
  ): Promise<T> {
    const client = new CommercetoolsClient(this.config).getClient(
      session.identity?.token
    );

    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .inventory()
      .get({
        queryArgs: {
          where: `sku=${payload.sku}`,
        },
      })
      .execute();

    return this.parseSingle(remote.body, session);
  }

  protected override parseSingle(_body: unknown, session: Session): T {
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
        cache: { hit: false, key: this.generateCacheKeySingle(model.identifier, session) },
        placeholder: false
      };

      return this.assert(model);
  }


}
