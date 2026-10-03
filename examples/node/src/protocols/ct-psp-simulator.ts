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
  const apiRoot = createApiBuilderFromCtpClient(ctpClient).withProjectKey({
    projectKey: config.projectKey,
  });

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
