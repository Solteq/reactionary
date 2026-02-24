import type { CartIdentifier } from '@reactionary/core';
import type { MyCartUpdateAction } from '@commercetools/platform-sdk';
import type { CommercetoolsProcedureContext } from '../../core/context.js';

type VersionedCartIdentifier = CartIdentifier & { version: number };

export async function getCommercetoolsCartClients(provider: CommercetoolsProcedureContext) {
  const root = await provider.client.getClient();
  const project = root.withProjectKey({ projectKey: provider.config.projectKey });

  return {
    carts: project.me().carts(),
    activeCart: project.me().activeCart(),
    orders: project.me().orders(),
  };
}

async function resolveVersionedCartIdentifier(
  provider: CommercetoolsProcedureContext,
  cart: CartIdentifier,
): Promise<VersionedCartIdentifier> {
  const candidate = cart as Partial<VersionedCartIdentifier>;
  if (typeof candidate.version === 'number') {
    return candidate as VersionedCartIdentifier;
  }

  const client = await getCommercetoolsCartClients(provider);
  const current = await client.carts.withId({ ID: cart.key }).get().execute();
  return {
    key: current.body.id,
    version: current.body.version || 0,
  } satisfies VersionedCartIdentifier;
}

export async function createCommercetoolsCart(
  provider: CommercetoolsProcedureContext,
  currencyCode: string,
  countryCode: string,
  locale: string,
): Promise<CartIdentifier> {
  const client = await getCommercetoolsCartClients(provider);
  const response = await client.carts
    .post({
      body: {
        currency: currencyCode || 'USD',
        country: countryCode || 'US',
        locale,
      },
    })
    .execute();

  return {
    key: response.body.id,
  } satisfies CartIdentifier;
}

export async function applyCartActions(
  provider: CommercetoolsProcedureContext,
  cart: CartIdentifier,
  actions: MyCartUpdateAction[],
) {
  const client = await getCommercetoolsCartClients(provider);
  const ctId = await resolveVersionedCartIdentifier(provider, cart);

  const response = await client.carts
    .withId({ ID: ctId.key })
    .post({
      body: {
        version: ctId.version,
        actions,
      },
    })
    .execute();

  return response.body;
}

export async function deleteCommercetoolsCart(provider: CommercetoolsProcedureContext, cart: CartIdentifier) {
  const client = await getCommercetoolsCartClients(provider);
  const ctId = await resolveVersionedCartIdentifier(provider, cart);

  await client.carts
    .withId({ ID: ctId.key })
    .delete({
      queryArgs: {
        version: ctId.version,
        dataErasure: false,
      },
    })
    .execute();
}
