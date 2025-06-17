import {
  Cart,
  CartGetPayload,
  CartItemAddPayload,
  CartItemAdjustPayload,
  CartItemRemovePayload,
  CartItemSchema,
  CartProvider,
  Session,
} from '@reactionary/core';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { z } from 'zod';
import { CommercetoolsClient } from '../core/client';
import { Cart as CTCart } from '@commercetools/platform-sdk';

export class CommercetoolsCartProvider<Q extends Cart> extends CartProvider<Q> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<Q>) {
    super(schema);

    this.config = config;
  }

  public override async add(
    payload: CartItemAddPayload,
    session: Session
  ): Promise<Q> {
    const client = this.getClient(session);

    let id = payload.cart.key;
    let version = 0;

    if (!id) {
      const remoteCart = await client
        .post({
          body: {
            currency: 'USD',
            country: 'US',
          },
        })
        .execute();

      id = remoteCart.body.id;
      version = remoteCart.body.version;
    } else {
        // TODO: Consider whether we can skip this step by proxying the version as part of the CommercetoolsCartIdentifier
        const existing = await client.withId({ ID: payload.cart.key }).get().execute();
        
        version = existing.body.version;
    }

    const remoteAdd = await client
      .withId({ ID: id })
      .post({
        body: {
          version: version,
          actions: [
            {
              action: 'addLineItem',
              quantity: payload.quantity,
              productId: payload.product.key,
            },
          ],
        },
      })
      .execute();

    const result = this.composeCart(remoteAdd.body);

    return result;
  }

  public override async get(
    payload: CartGetPayload,
    session: Session
  ): Promise<Q> {
    const base = this.base();

    if (payload.cart.key) {
      const client = this.getClient(session);
      const remote = await client
        .withId({ ID: payload.cart.key })
        .get()
        .execute();

      const result = this.composeCart(remote.body);

      return result;
    }

    return base;
  }

  public override async adjust(
    payload: CartItemAdjustPayload,
    session: Session
  ): Promise<Q> {
    const client = this.getClient(session);

    // TODO: Consider whether we can skip this step by proxying the version as part of the CommercetoolsCartIdentifier
    const existing = await client.withId({ ID: payload.cart.key }).get().execute();

    const remote = await client
      .withId({ ID: payload.cart.key })
      .post({
        body: {
          version: existing.body.version,
          actions: [
            {
              action: 'changeLineItemQuantity',
              lineItemId: payload.item.key,
              quantity: payload.quantity,
            },
          ],
        },
      })
      .execute();

    const result = this.composeCart(remote.body);

    return result;
  }

  public override async remove(
    payload: CartItemRemovePayload,
    session: Session
  ): Promise<Q> {
    const client = this.getClient(session);

    // TODO: Consider whether we can skip this step by proxying the version as part of the CommercetoolsCartIdentifier
    const existing = await client.withId({ ID: payload.cart.key }).get().execute();

    const remote = await client
      .withId({ ID: payload.cart.key })
      .post({
        body: {
          version: existing.body.version,
          actions: [
            {
              action: 'removeLineItem',
              lineItemId: payload.item.key,
            },
          ],
        },
      })
      .execute();

    const result = this.composeCart(remote.body);

    return result;
  }

  protected getClient(session: Session) {
    const client = new CommercetoolsClient(this.config).getClient(
      session.identity.token
    );

    const cartClient = client
      .withProjectKey({ projectKey: this.config.projectKey })
      .carts();

    return cartClient;
  }

  protected composeCart(remote: CTCart): Q {
    const result = this.base();

    result.identifier.key = remote.id;

    for (const remoteItem of remote.lineItems) {
      const item = CartItemSchema.parse({});

      item.identifier.key = remoteItem.id;
      item.product.key = remoteItem.productId;
      item.quantity = remoteItem.quantity;

      result.items.push(item);
    }

    return result;
  }
}
