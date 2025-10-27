import {
  ProductAttributeSchema,
  ProductIdentifierSchema,
  ProductProvider
} from '@reactionary/core';
import type { z } from 'zod';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import type { Product, ProductQueryById, ProductQueryBySKU, ProductQueryBySlug, RequestContext, SKUIdentifier } from '@reactionary/core';
import type { Cache } from '@reactionary/core';
import createDebug from 'debug';
import { MedusaClient } from '../core/client.js';
import { MedusaSKUIdentifierSchema, type MedusaSKUIdentifier } from '../schema/medusa.schema.js';
import type { StoreProduct } from '@medusajs/types';
import Medusa from '@medusajs/js-sdk';
import { th } from 'zod/v4/locales';

const debug = createDebug('reactionary:medusa:product');

export class MedusaProductProvider<
  T extends Product = Product
> extends ProductProvider<T> {
  protected config: MedusaConfiguration;

  constructor(config: MedusaConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);
   this.config = config;
  }


  public override async getById(payload: ProductQueryById, reqCtx: RequestContext): Promise<T> {
    const client = await new MedusaClient(this.config).getClient(reqCtx);
    if (debug.enabled) {
      debug(`Fetching product by ID: ${payload.id}`);
    }
    let response;
    try {
      response = await client.store.product.retrieve(payload.id);
    } catch(error) {
      if (debug.enabled) {
        debug(`Product with ID: ${payload.id} not found, returning empty product.`);
      }
      return this.createEmptyProduct(payload.id);
    }
    return this.parseSingle(response.product, reqCtx);
  }

  public override async getBySlug(payload: ProductQueryBySlug, reqCtx: RequestContext): Promise<T | null> {
    const client = await new MedusaClient(this.config).getClient(reqCtx);
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
    return this.parseSingle(response.products[0], reqCtx);
  }


  public override async getBySKU(payload: ProductQueryBySKU, reqCtx: RequestContext): Promise<T> {
    const client = await new MedusaClient(this.config).getClient(reqCtx);
    if (debug.enabled) {
      debug(`Fetching product by SKU: ${Array.isArray(payload) ? payload.join(', ') : payload}`);
    }

    const arrayForm: SKUIdentifier[] = Array.isArray(payload)
      ? payload.map((p) => p.sku )
      : [payload.sku] ;

    const productIds = arrayForm.map((identifier) => {
      return (identifier as MedusaSKUIdentifier).productIdentifier.key
    });

    const response = await client.store.product.list({
      '$or': productIds.map(x => {
        return {
          id: x
        }
      }),
      limit: productIds.length,
      offset: 0
    });

    if (debug.enabled) {
      debug(`Found ${response.count} products for SKUs: ${arrayForm.map(sku => sku.key).join(', ')}`);
    }

    // For simplicity, return the first matched product
    return this.parseSingle(response.products[0], reqCtx);
  }



  protected override parseSingle(_body: StoreProduct, reqCtx: RequestContext): T {
    const model = this.newModel();

    model.identifier = ProductIdentifierSchema.parse({ key: _body.id });
    model.name = _body.title;
    model.slug = _body.handle;
    model.description = _body.subtitle || '';

    if (_body.images && _body.images.length > 0) {
      model.images = _body.images.map((img) => img.url);
      model.image = model.images[0];
    }

    model.attributes = [];
    this.parseAttributes(_body, model);

    model.skus = [];

    for (const variant of _body.variants || []) {
      const skuId = MedusaSKUIdentifierSchema.parse({
        sku: variant.sku,
        productIdentifier: { key: _body.id }
      });
      model.skus.push({
        identifier: skuId,
      });
    }

    if (debug.enabled) {
      debug(`Parsed product: ${model.name} (ID: ${model.identifier.key})`, model);
    }


    model.meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(model.identifier, reqCtx) },
      placeholder: false
    };

    return this.assert(model);
  }


  protected parseAttributes(_body: StoreProduct, model: T): void {
    if (_body.origin_country) {
      model.attributes.push(ProductAttributeSchema.parse({
        id: 'origin_country',
        name: 'Origin Country',
        value: _body.origin_country,
      }));
    }

    if (_body.height) {
      model.attributes.push(ProductAttributeSchema.parse({
        id: 'height',
        name: 'Height',
        value: _body.height,
      }));
    }

    if (_body.weight) {
      model.attributes.push(ProductAttributeSchema.parse({
        id: 'weight',
        name: 'Weight',
        value: _body.weight,
      }));
    }

    if (_body.length) {
      model.attributes.push(ProductAttributeSchema.parse({
        id: 'length',
        name: 'Length',
        value: _body.length,
      }));
    }

    if (_body.width) {
      model.attributes.push(ProductAttributeSchema.parse({
        id: 'width',
        name: 'Width',
        value: _body.width,
      }));
    }

    if (_body.material) {
      model.attributes.push(ProductAttributeSchema.parse({
        id: 'material',
        name: 'Material',
        value: _body.material,
      }));
    }
  }
}

