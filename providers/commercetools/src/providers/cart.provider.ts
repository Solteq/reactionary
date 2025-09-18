import {
  Cart,
  CartItemSchema,
  CartProvider,
  Cache,
  Currency,
} from '@reactionary/core';
import type {
  CartMutationItemAdd,
  CartMutationItemQuantityChange,
  CartMutationItemRemove,
  CartQueryById,
  Session,
} from '@reactionary/core';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { z } from 'zod';
import { CommercetoolsClient } from '../core/client';
import type { Cart as CTCart } from '@commercetools/platform-sdk';
import { traced } from '@reactionary/otel';


export class CommercetoolsCartProvider<
  T extends Cart = Cart
> extends CartProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache
  ) {
    super(schema, cache);

    this.config = config;
  }

  @traced()
  public override async getById(
    payload: CartQueryById,
    session: Session
  ): Promise<T> {
    if (!payload.cart.key) {
      const result = this.newModel();
      result.meta = {
        cache: { hit: false, key: 'empty' },
        placeholder: true
      };
      return this.assert(result);
    }

    const client = this.getClient(session);
    const remote = await client
      .withId({ ID: payload.cart.key })
      .get()
      .execute();

    return this.parseSingle(remote.body, session);
  }

  @traced()
  public override async add(
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
            currency: session.languageContext.currencyCode || 'USD',
            country: session.languageContext.countryCode || 'US',
            locale: session.languageContext.locale,
          },
        })
        .execute();

      id = remoteCart.body.id;
      version = remoteCart.body.version;
    } else {
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

    return this.parseSingle(remoteAdd.body, session);
  }

  @traced()
  public override async remove(
    payload: CartMutationItemRemove,
    session: Session
  ): Promise<T> {
    const client = this.getClient(session);

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

    return this.parseSingle(remote.body, session);
  }

  @traced()
  public override async changeQuantity(
    payload: CartMutationItemQuantityChange,
    session: Session
  ): Promise<T> {
    const client = this.getClient(session);

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

    return this.parseSingle(remote.body, session  );
  }

  @traced()
  protected getClient(session: Session) {
    const client = new CommercetoolsClient(this.config).getClient(
      session.identity.token
    );

    const cartClient = client
      .withProjectKey({ projectKey: this.config.projectKey })
      .carts();

    return cartClient;
  }

  @traced()
  protected override parseSingle(remote: CTCart, session: Session): T {
    const result = this.newModel();

    result.identifier.key = remote.id;


    result.name = remote.custom?.fields['name'] || '';
    result.description = remote.custom?.fields['description'] || '';

    const grandTotal = remote.totalPrice.centAmount || 0;
    const shippingTotal = remote.shippingInfo?.price.centAmount || 0;
    const productTotal = grandTotal - shippingTotal;
    const taxTotal = remote.taxedPrice?.totalTax?.centAmount || 0;
    const discountTotal = remote.discountOnTotalPrice?.discountedAmount.centAmount || 0;
    const surchargeTotal = 0;
    const currency = remote.totalPrice.currencyCode as Currency;

    result.price = {
      totalTax: {
        value: taxTotal / 100,
        currency
      },
      totalDiscount: {
        value: discountTotal/ 100,
        currency
      },
      totalSurcharge: {
        value: surchargeTotal / 100,
        currency
      },
      totalShipping: {
        value: shippingTotal / 100,
        currency: remote.shippingInfo?.price.currencyCode as Currency,
      },
      totalProductPrice: {
        value: productTotal  / 100,
        currency
      },
      grandTotal: {
        value: grandTotal / 100,
        currency
      }
    }

    for (const remoteItem of remote.lineItems) {
      const item = CartItemSchema.parse({});

      item.identifier.key = remoteItem.id;
      item.product.key = remoteItem.productId;
      item.quantity = remoteItem.quantity;

      const unitPrice = remoteItem.price.value.centAmount;
      const totalPrice = remoteItem.totalPrice.centAmount || 0;
      const totalDiscount = remoteItem.price.discounted?.value.centAmount || 0;
      const unitDiscount = totalDiscount / remoteItem.quantity;


      item.price = {
        unitPrice: {
          value: unitPrice / 100,
          currency
        },
        unitDiscount: {
          value: (unitDiscount / 100),
          currency
        },
        totalPrice: {
          value: (totalPrice || 0) / 100,
          currency
        },
        totalDiscount: {
          value: totalDiscount / 100,
          currency
        },
      }

      result.items.push(item);
    }

    result.meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(result.identifier, session) },
      placeholder: false
    };

    return this.assert(result);
  }


}
