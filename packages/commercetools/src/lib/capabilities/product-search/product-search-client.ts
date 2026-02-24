import type { CommercetoolsProcedureContext } from '../../core/context.js';

export async function getCommercetoolsProductSearchClient(provider: CommercetoolsProcedureContext) {
  const root = await provider.client.getClient();
  return root
    .withProjectKey({ projectKey: provider.config.projectKey })
    .products();
}

export async function resolveCommercetoolsCategoryFromKey(provider: CommercetoolsProcedureContext, key: string) {
  const root = await provider.client.getClient();
  const project = root.withProjectKey({ projectKey: provider.config.projectKey });
  const response = await project.categories().withKey({ key }).get().execute();
  return response.body;
}

export async function resolveCommercetoolsCategoryFromId(provider: CommercetoolsProcedureContext, id: string) {
  const root = await provider.client.getClient();
  const project = root.withProjectKey({ projectKey: provider.config.projectKey });
  const response = await project.categories().withId({ ID: id }).get().execute();
  return response.body;
}
