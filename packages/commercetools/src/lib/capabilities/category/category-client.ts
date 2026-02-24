import type { CommercetoolsProcedureContext } from '../../core/context.js';

export async function getCommercetoolsCategoryClient(provider: CommercetoolsProcedureContext) {
  const client = await provider.client.getClient();
  return client
    .withProjectKey({ projectKey: provider.config.projectKey })
    .categories();
}
