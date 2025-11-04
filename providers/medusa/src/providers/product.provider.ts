import {
  ImageSchema,
  ProductAttributeSchema,
  ProductIdentifierSchema,
  ProductProvider,
  ProductVariantIdentifierSchema,
  ProductVariantSchema
} from '@reactionary/core';
import type { z } from 'zod';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import type { Product, ProductQueryById, ProductQueryBySKU, ProductQueryBySlug, RequestContext, ProductVariantIdentifier, Store, ProductVariant } from '@reactionary/core';
import type { Cache , Image } from '@reactionary/core';
import createDebug from 'debug';
import { MedusaAdminClient, MedusaClient } from '../core/client.js';

import type { StoreProduct, StoreProductImage, StoreProductVariant } from '@medusajs/types';
import Medusa from '@medusajs/js-sdk';

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
    const sku = payload.variant.sku;

    // FIXME: Medusa does not support searching by SKU directly, so we have to use the admin client to search for products with variants matching the SKU
    const adminClient = await new MedusaAdminClient(this.config).getClient(reqCtx);

    const productsResponse = await adminClient.admin.product.list({
      limit: 1,
      offset: 0,
      variants: {
        $or: [{ ean: sku }, { upc: sku }, { barcode: sku }],
      },
    });

    const product = productsResponse.products[0];
    if (!product) {
      throw new Error(`Product with SKU ${sku} not found`);
    }

    const variant = product.variants?.find((v) => v.sku === sku);
    if (!variant) {
      throw new Error(`Variant with SKU ${sku} not found`);
    }
    product.variants = [];
    product.variants.push(variant);

    // For simplicity, return the first matched product
    return this.parseSingle(product, reqCtx);
  }



  protected override parseSingle(_body: StoreProduct, reqCtx: RequestContext): T {
    const model = this.newModel();




    model.identifier = ProductIdentifierSchema.parse({ key: _body.id });
    model.name = _body.title;
    model.slug = _body.handle;
    model.description = _body.description || '' || _body.subtitle || '';
    model.sharedAttributes = [];

    this.parseAttributes(_body, model);

    if (!_body.variants) {
      debug('Product has no variants', _body);
      throw new Error('Product has no variants ' + _body.id);
    }
    const mainVariant = this.parseVariant(_body.variants[0], _body, reqCtx);
    model.mainVariant = mainVariant;

    if (debug.enabled) {
      debug(`Parsed product: ${model.name} (ID: ${model.identifier.key})`, model);
    }


    model.meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(model.identifier, reqCtx) },
      placeholder: false
    };

    return this.assert(model);
  }

  protected parseVariant(variant: StoreProductVariant, product: StoreProduct, reqCtx: RequestContext) {
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

