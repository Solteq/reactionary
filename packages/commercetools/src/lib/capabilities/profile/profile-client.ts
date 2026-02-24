import type { CommercetoolsProcedureContext } from '../../core/context.js';

export async function getCommercetoolsProfileClient(provider: CommercetoolsProcedureContext) {
  const root = await provider.client.getClient();
  return root.withProjectKey({ projectKey: provider.config.projectKey });
}
