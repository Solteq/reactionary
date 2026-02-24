import type { CheckoutIdentifier } from '@reactionary/core';
import type { MyCartUpdateAction } from '@commercetools/platform-sdk';
import type { CommercetoolsProcedureContext } from '../../core/context.js';

type VersionedCheckoutIdentifier = CheckoutIdentifier & { version: number };

export function asVersionedCheckoutIdentifier(checkout: CheckoutIdentifier): VersionedCheckoutIdentifier {
  return checkout as VersionedCheckoutIdentifier;
}

export async function getCommercetoolsCheckoutClients(provider: CommercetoolsProcedureContext) {
  const root = await provider.client.getClient();
  const project = root.withProjectKey({ projectKey: provider.config.projectKey });

  return {
    payments: project.me().payments(),
    carts: project.me().carts(),
    shippingMethods: project.shippingMethods(),
    orders: project.me().orders(),
  };
}

export async function applyCheckoutActions(
  provider: CommercetoolsProcedureContext,
  checkout: CheckoutIdentifier,
  actions: MyCartUpdateAction[],
) {
  const client = await getCommercetoolsCheckoutClients(provider);
  const candidate = asVersionedCheckoutIdentifier(checkout);
  const ctId = typeof candidate.version === 'number'
    ? candidate
    : {
        key: checkout.key,
        version: (await client.carts.withId({ ID: checkout.key }).get().execute()).body.version || 0,
      };

  const response = await client.carts
    .withId({ ID: ctId.key })
    .post({
      queryArgs: {
        expand: ['paymentInfo.payments[*]', 'shippingInfo.shippingMethod'],
      },
      body: {
        version: ctId.version,
        actions,
      },
    })
    .execute();

  return response.body;
}
