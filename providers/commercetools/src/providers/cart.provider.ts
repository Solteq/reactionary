import {
  Cart,
  CartItemSchema,
  CartMutation,
  CartMutationItemAdd,
  CartMutationItemQuantityChange,
  CartMutationItemRemove,
  CartProvider,
  CartQuery,
  Session,
} from '@reactionary/core';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { z } from 'zod';
import { CommercetoolsClient } from '../core/client';
import { Cart as CTCart } from '@commercetools/platform-sdk';

export class CommercetoolsCartProvider<
  T extends Cart = Cart,
  Q extends CartQuery = CartQuery,
  M extends CartMutation = CartMutation
> extends CartProvider<T, Q, M> {
  protected config: CommercetoolsConfiguration;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    querySchema: z.ZodType<Q, Q>,
    mutationSchema: z.ZodType<M, M>,
    cache: any
  ) {
    super(schema, querySchema, mutationSchema, cache);

    this.config = config;
  }

  protected override async fetch(queries: Q[], session: Session): Promise<T[]> {
    const results = [];

    for (const query of queries) {
      if (query.cart.key) {
        const client = this.getClient(session);
        const remote = await client
          .withId({ ID: query.cart.key })
          .get()
          .execute();

        const result = this.composeCart(remote.body);

        results.push(result);
      }
    }

    return results;
  }
  protected override async process(
    mutations: M[],
    session: Session
  ): Promise<T> {
    let cart = this.newModel();

    /**
     * TODO: Optimize this, since CT as a remote provider allows us to forward multiple changes
     * at once. As part of the current rewrite, this is mostly preserved as was before.
     */
    for (const mutation of mutations) {
      switch (mutation.mutation) {
        case 'add':
          cart = await this.add(mutation, session);
          break;
        case 'adjustQuantity':
          cart = await this.adjust(mutation, session);
          break;
        case 'remove':
          cart = await this.remove(mutation, session);
      }
    }

    return cart;
  }

  protected async adjust(
    payload: CartMutationItemQuantityChange,
    session: Session
  ): Promise<T> {
    const client = this.getClient(session);

    // TODO: Consider whether we can skip this step by proxying the version as part of the CommercetoolsCartIdentifier
    const existing = await client
      .withId({ ID: payload.cart.key })
      .get()
      .execute();

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

    protected async add(
    payload: CartMutationItemAdd,
    session: Session
  ): Promise<T> {
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

  protected async remove(
    payload: CartMutationItemRemove,
    session: Session
  ): Promise<T> {
    const client = this.getClient(session);

    // TODO: Consider whether we can skip this step by proxying the version as part of the CommercetoolsCartIdentifier
    const existing = await client
      .withId({ ID: payload.cart.key })
      .get()
      .execute();

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

  protected composeCart(remote: CTCart): T {
    const result = this.newModel();

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
