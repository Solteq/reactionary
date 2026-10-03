import 'dotenv/config';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import { ClientBuilder } from '@commercetools/ts-client';
import { getCommercetoolsTestConfiguration } from '../utils.js';

/**
 * Simulates the payment service provider's out-of-band authorization callback
 * for commercetools: in production a PSP integration adds an Authorization
 * transaction to the payment (e.g. via webhook) once the buyer has paid. The
 * reactionary capability surface deliberately has no operation for this, so
 * the e2e test plays the PSP's role directly against the commercetools API to
 * let the deferred payment proceed.
 */
export async function simulateCommercetoolsPaymentAuthorization(
  paymentIds: string[],
): Promise<void> {
  const apiRoot = createAdminApiRoot();

  for (const paymentId of paymentIds) {
    const payment = await apiRoot.payments().withId({ ID: paymentId }).get().execute();

    await apiRoot
      .payments()
      .withId({ ID: paymentId })
      .post({
        body: {
          version: payment.body.version,
          actions: [
            {
              action: 'addTransaction',
              transaction: {
                type: 'Authorization',
                state: 'Success',
                amount: payment.body.amountPlanned,
              },
            },
          ],
        },
      })
      .execute();
  }
}

/**
 * Authorizes the payments of the live checkout created from a cart. Like a
 * PSP correlating by merchant reference, it finds the checkout through the
 * originating cart id the commercetools checkout records in its custom
 * fields; transient pricing checkouts are deleted, so the active one is the
 * real checkout.
 */
export async function simulateCommercetoolsPaymentAuthorizationForCart(
  originalCartId: string,
): Promise<void> {
  await authorizeLatestCheckout(
    `cartState = "Active" and custom(fields(commerceToolsCartId = "${originalCartId}")) and paymentInfo is defined`,
  );
}

/**
 * Authorizes the payments of the live checkout placed for a buyer email, as
 * a PSP would correlate by the order's contact details.
 */
export async function simulateCommercetoolsPaymentAuthorizationForEmail(
  email: string,
): Promise<void> {
  await authorizeLatestCheckout(`cartState = "Active" and billingAddress(email = "${email}") and paymentInfo is defined`);
}

async function authorizeLatestCheckout(where: string): Promise<void> {
  const checkouts = await createAdminApiRoot()
    .carts()
    .get({ queryArgs: { where, sort: 'createdAt desc', limit: 1 } })
    .execute();
  const paymentIds = (checkouts.body.results[0]?.paymentInfo?.payments ?? []).map((payment) => payment.id);

  if (paymentIds.length === 0) {
    throw new Error(`No payment found on a checkout matching: ${where}`);
  }

  await simulateCommercetoolsPaymentAuthorization(paymentIds);
}

function createAdminApiRoot() {
  const config = getCommercetoolsTestConfiguration();
  // Managing payment transactions needs the view_payments/manage_payments
  // scopes, which the storefront client does not have — use the admin client
  // (the same credentials the capabilities use for privileged operations).
  const ctpClient = new ClientBuilder()
    .withProjectKey(config.projectKey)
    .withClientCredentialsFlow({
      host: config.authUrl,
      projectKey: config.projectKey,
      credentials: {
        clientId: config.adminClientId || config.clientId,
        clientSecret: config.adminClientSecret || config.clientSecret,
      },
    })
    .withHttpMiddleware({ host: config.apiUrl, httpClient: fetch })
    .build();
  return createApiBuilderFromCtpClient(ctpClient).withProjectKey({
    projectKey: config.projectKey,
  });
}
