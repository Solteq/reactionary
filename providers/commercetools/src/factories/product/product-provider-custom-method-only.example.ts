import { ProductSchema } from "@reactionary/core";
import type { ProductFactoryOutput, Result } from "@reactionary/core";
import { CommercetoolsProductFactory } from "./product.factory.js";
import { CommercetoolsProductProvider } from "../../providers/product.provider.js";
import { withCommercetoolsCapabilities } from "../../core/initialize.js";
import { assertNotAny, assertType } from "./utils.example.js";

const cache = {} as any;
const context = {} as any;
const config = {} as any;
const api = {} as any;

class ExtendedCommercetoolsProductProvider extends CommercetoolsProductProvider<CommercetoolsProductFactory> {
  public async getByCustomIdentifier(
    identifier: string
  ): Promise<Result<ProductFactoryOutput<CommercetoolsProductFactory>>> {
    return this.getById({
      identifier: { key: identifier },
    });
  }
}

const withExtendedProviderFactory = withCommercetoolsCapabilities(config, {
  product: {
    enabled: true,
    factory: new CommercetoolsProductFactory(ProductSchema),
    provider: ({ cache, context, config, commercetoolsApi }) =>
      new ExtendedCommercetoolsProductProvider(
        cache,
        context,
        config,
        commercetoolsApi,
        new CommercetoolsProductFactory(ProductSchema)
      ),
  },
});

const client = withExtendedProviderFactory(cache, context);

client.product.getByCustomIdentifier("p-2").then((x) => {
  assertNotAny(x);
  if (x.success) {
    assertNotAny(x.value);
    assertNotAny(x.value.name);
    assertType<string>(x.value.name);
  }
});
