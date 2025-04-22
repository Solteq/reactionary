import { ProductProvider, ProductIdentifier, Product, ProductSchema } from '@reactionary/core';
import { CommercetoolsConfig } from '../core/configuration';
import { CommercetoolsClient } from '../core/client';

export class CommercetoolsProductProvider extends ProductProvider {
  protected config: CommercetoolsConfig;

  constructor(config: CommercetoolsConfig) {
    super();

    this.config = config;
  }

  public async get(identifier: ProductIdentifier): Promise<Product> {
    const result = ProductSchema.parse({});
    const client = new CommercetoolsClient(this.config).createAnonymousClient();

    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .productProjections()
      .withId({
        ID: identifier.id,
      })
      .get()
      .execute();

    result.identifier.id = remote.body.id;
    result.name = remote.body.name['en-US'];

    if (remote.body.description) {
        result.description = remote.body.description['en-US'];
    }

    if (remote.body.masterVariant.images) {
        result.image = remote.body.masterVariant.images[0].url;
    }
    

    return ProductSchema.parse(result);
  }
}
