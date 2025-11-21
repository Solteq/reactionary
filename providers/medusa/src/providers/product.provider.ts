import type { Cache, Image, Product, ProductQueryById, ProductQueryBySKU, ProductQueryBySlug, ProductVariant, ProductVariantIdentifier, RequestContext } from '@reactionary/core';
import {
  CategoryIdentifierSchema,
  ImageSchema,
  ProductAttributeSchema,
  ProductIdentifierSchema,
  ProductProvider,
  ProductSchema,
  ProductQueryByIdSchema,
  ProductQueryBySlugSchema,
  ProductQueryBySKUSchema,
  ProductVariantIdentifierSchema,
  ProductVariantSchema,
  Reactionary,
} from '@reactionary/core';
import createDebug from 'debug';
import type { z } from 'zod';
import type { MedusaClient } from '../core/client.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

import type { StoreProduct, StoreProductImage, StoreProductVariant } from '@medusajs/types';

const debug = createDebug('reactionary:medusa:product');

export class MedusaProductProvider<
  T extends Product = Product
> extends ProductProvider<T> {
  protected config: MedusaConfiguration;

  constructor(config: MedusaConfiguration, schema: z.ZodType<T>, cache: Cache, context: RequestContext, public client: MedusaClient) {
  super(schema, cache, context);
   this.config = config;
  }


  @Reactionary({
    inputSchema: ProductQueryByIdSchema,
    outputSchema: ProductSchema,
  })
  public override async getById(payload: ProductQueryById): Promise<T> {
    const client = await this.client.getClient();
    if (debug.enabled) {
      debug(`Fetching product by ID: ${payload.identifier.key}`);
    }
    let response;
    try {
      response = await client.store.product.retrieve(payload.identifier.key);

    } catch(error) {
      if (debug.enabled) {
        debug(`Product with ID: ${payload.identifier.key} not found, returning empty product. Error %O `, error);
      }
      return this.createEmptyProduct(payload.identifier.key);
    }
    return this.parseSingle(response.product);
  }

  @Reactionary({
    inputSchema: ProductQueryBySlugSchema,
    outputSchema: ProductSchema.nullable(),
  })
  public override async getBySlug(payload: ProductQueryBySlug): Promise<T | null> {
    const client = await this.client.getClient();
    if (debug.enabled) {
      debug(`Fetching product by slug: ${payload.slug}`);
    }

    const response = await client.store.product.list({
      handle: payload.slug,
      limit: 1,
      offset: 0
    });

    if (debug.enabled) {
      debug(`Found ${response.count} products for slug: ${payload.slug}`);
    }

    if (response.count === 0) {
      return null;
    }
    return this.parseSingle(response.products[0]);
  }


  @Reactionary({
    inputSchema: ProductQueryBySKUSchema,
    outputSchema: ProductSchema,
  })
  public override async getBySKU(payload: ProductQueryBySKU): Promise<T> {

    if (debug.enabled) {
      debug(`Fetching product by SKU: ${Array.isArray(payload) ? payload.join(', ') : payload}`);
    }
    const sku = payload.variant.sku;
    const product = await this.client.resolveProductForSKU(sku);

    const variant = product.variants?.find((v) => v.sku === sku);
    if (!variant) {
      throw new Error(`Variant with SKU ${sku} not found`);
    }
    product.variants = [];
    product.variants.push(variant);

    // For simplicity, return the first matched product
    return this.parseSingle(product);
  }

  protected override parseSingle(_body: StoreProduct): T {
    const model = this.newModel();

    model.identifier = ProductIdentifierSchema.parse({ key: _body.id });
    model.name = _body.title;
    model.slug = _body.handle;
    model.description = _body.description || '' || _body.subtitle || '';
    model.sharedAttributes = [];
    model.parentCategories.push(
      ...
      _body.categories?.map( (cat) => cat.metadata?.['external_id'] ).map( (id) => CategoryIdentifierSchema.parse({ key: id || '' }) ) || []
    )
    this.parseAttributes(_body, model);

    if (!_body.variants) {
      debug('Product has no variants', _body);
      throw new Error('Product has no variants ' + _body.id);
    }
    const mainVariant = this.parseVariant(_body.variants[0], _body);
    model.mainVariant = mainVariant;

    if (debug.enabled) {
      debug(`Parsed product: ${model.name} (ID: ${model.identifier.key})`, model);
    }


    model.meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(model.identifier) },
      placeholder: false
    };

    return this.assert(model);
  }

  protected parseVariant(variant: StoreProductVariant, product: StoreProduct) {
    const result = ProductVariantSchema.parse({
      identifier: ProductVariantIdentifierSchema.parse({
        sku: variant.sku || '',
      } satisfies Partial<ProductVariantIdentifier>),
      name: variant.title || product.title,
      upc: variant.upc || undefined,
      ean: variant.ean || undefined,

      images: (product.images || []).map((img: StoreProductImage) => ImageSchema.parse({
        sourceUrl: img.url,
        altText: variant.title || product.title,
      } satisfies Partial<Image>)),

    } satisfies Partial<ProductVariant>);

    return result;
  }



  protected parseAttributes(_body: StoreProduct, model: T): void {
    if (_body.origin_country) {
      model.sharedAttributes.push(ProductAttributeSchema.parse({
        id: 'origin_country',
        name: 'Origin Country',
        value: _body.origin_country,
      }));
    }

    if (_body.height) {
      model.sharedAttributes.push(ProductAttributeSchema.parse({
        id: 'height',
        name: 'Height',
        value: _body.height,
      }));
    }

    if (_body.weight) {
      model.sharedAttributes.push(ProductAttributeSchema.parse({
        id: 'weight',
        name: 'Weight',
        value: _body.weight,
      }));
    }

    if (_body.length) {
      model.sharedAttributes.push(ProductAttributeSchema.parse({
        id: 'length',
        name: 'Length',
        value: _body.length,
      }));
    }

    if (_body.width) {
      model.sharedAttributes.push(ProductAttributeSchema.parse({
        id: 'width',
        name: 'Width',
        value: _body.width,
      }));
    }

    if (_body.material) {
      model.sharedAttributes.push(ProductAttributeSchema.parse({
        id: 'material',
        name: 'Material',
        value: _body.material,
      }));
    }
  }
}

