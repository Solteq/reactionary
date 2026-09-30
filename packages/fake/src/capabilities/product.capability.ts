import {
  type Cache,
  type NotFoundError,
  type ProductFactory,
  type ProductFactoryOutput,
  type ProductFactoryWithOutput,
  type ProductQueryById,
  ProductQueryByIdSchema,
  type ProductQueryBySKU,
  ProductQueryBySKUSchema,
  type ProductQueryBySlug,
  ProductQueryBySlugSchema,
  ProductCapability,
  ProductSchema,
  type RequestContext,
  type Result,
  Reactionary,
  success,
  type Product,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';
import type { FakeProductFactory } from '../factories/product/product.factory.js';

export class FakeProductCapability<
  TFactory extends ProductFactory = FakeProductFactory,
> extends ProductCapability<ProductFactoryOutput<TFactory>> {
  protected config: FakeConfiguration;
  protected factory: ProductFactoryWithOutput<TFactory>;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: ProductFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: ProductQueryByIdSchema,
    outputSchema: ProductSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async getById(
    payload: ProductQueryById,
  ): Promise<Result<ProductFactoryOutput<TFactory>>> {
    return success(this.composeSingle(payload.identifier.key));
  }

  @Reactionary({
    inputSchema: ProductQueryBySlugSchema,
    outputSchema: ProductSchema,
  })
  public override async getBySlug(
    payload: ProductQueryBySlug,
  ): Promise<Result<ProductFactoryOutput<TFactory>, NotFoundError>> {
    return success(this.composeSingle(payload.slug));
  }

  @Reactionary({
    inputSchema: ProductQueryBySKUSchema,
    outputSchema: ProductSchema,
  })
  public override async getBySKU(
    payload: ProductQueryBySKU,
  ): Promise<Result<ProductFactoryOutput<TFactory>>> {
    return success(this.composeSingle(payload.variant.sku));
  }

  protected composeSingle(body: string): ProductFactoryOutput<TFactory> {
    const generator = new Faker({
      seed: 42,
      locale: [en, base],
    });

    const isOrganic = generator.datatype.boolean({ probability: 0.2});
    const result = {
      identifier: {
        key: body,
      },
      name: generator.commerce.productName(),
      slug: body,
      brand: '',
      longDescription: '',
      mainVariant: {
        barcode: '',
        ean: '',
        gtin: '',
        identifier: {
          sku: '',
        },
        images: [],
        name: '',
        options: [],
        upc: '',
      },
      description: generator.commerce.productDescription(),
      manufacturer: '',
      options: [],
      parentCategories: [],
      published: true,
      sharedAttributes: [],
      variants: [],
      complianceData: {
        ce_marking: generator.datatype.boolean({ probability: 0.2}),
        weee_symbol: generator.datatype.boolean({ probability: 0.2}),
        additional_disclosures: generator.datatype.boolean({ probability: 0.2}) ? generator.lorem.sentence() : undefined,
        composition: generator.datatype.boolean({ probability: 0.2}) ? generator.lorem.sentence() : undefined,
        energy_class: generator.datatype.boolean({ probability: 0.2}) ? ['A','B','C','D','E','F','G'].at(generator.number.int({ min: 0, max: 6 })) : undefined,
        garan_duration: generator.datatype.boolean({ probability: 0.1}) ? generator.number.int({ min: 3, max: 5}) * 12: undefined,
        organic: {
          is_organic: isOrganic,
          certificate_url:  isOrganic ? generator.internet.url() : undefined,
          agriculture_origin: isOrganic ? generator.address.country() : undefined,
          control_body_code: isOrganic ? 'DKK-OEK-' + generator.number.int({ min: 1000, max: 9999 })   : undefined,
          certification_type: isOrganic ? ['EU_ORGANIC_LEAF', 'GOTS', 'ECOCERT'].at(generator.number.int({ min: 0, max: 2 })) : undefined,
        },
        traceability: {
          product_identifier: 'BATCH-' + generator.number.int({ min: 1000, max: 9999 }),
          manufacturer: {
            name: generator.company.name(),
            postal_address: generator.address.streetAddress() + ' ' + generator.address.country() + '-' + generator.address.zipCode() + ' ' + generator.address.city(),
            electronic_address: generator.internet.email({ provider: 'example.com' }),
          },
          eu_responsible_person: {
            name: generator.company.name(),
            postal_address: generator.address.streetAddress() + ' ' + generator.address.country() + '-' + generator.address.zipCode() + ' ' + generator.address.city(),
            electronic_address: generator.internet.email({ provider: 'example.com' }),
          }
        }
      }
    } satisfies Product;

    return this.factory.parseProduct(this.context, result);
  }
}
