import type { Cache, Image, NotFoundError, Product, ProductAttribute, ProductAttributeIdentifier, ProductAttributeValueIdentifier, ProductOptionIdentifier, ProductOptionValueIdentifier, ProductQueryById, ProductQueryBySKU, ProductQueryBySlug, ProductVariant, ProductVariantOption, RequestContext, Result } from '@reactionary/core';
import {
  CategoryIdentifierSchema,
  ProductIdentifierSchema,
  ProductProvider,
  ProductQueryByIdSchema,
  ProductQueryBySKUSchema,
  ProductQueryBySlugSchema,
  ProductSchema,
  Reactionary,
  success,
  error,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MedusaClient } from '../core/client.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

import type { StoreProduct, StoreProductImage, StoreProductVariant } from '@medusajs/types';

const debug = createDebug('reactionary:medusa:product');

export class MedusaProductProvider extends ProductProvider {
  protected config: MedusaConfiguration;

  constructor(config: MedusaConfiguration, cache: Cache, context: RequestContext, public client: MedusaClient) {
  super(cache, context);
   this.config = config;
  }

  @Reactionary({
    inputSchema: ProductQueryByIdSchema,
    outputSchema: ProductSchema,
  })
  public override async getById(payload: ProductQueryById): Promise<Result<Product>> {
    const client = await this.client.getClient();
    if (debug.enabled) {
      debug(`Fetching product by ID: ${payload.identifier.key}`);
    }
    let response;
    try {
      response = await client.store.product.retrieve(payload.identifier.key, {
        fields: '+metadata,+categories.metadata.*',
      });

    } catch(error) {
      if (debug.enabled) {
        debug(`Product with ID: ${payload.identifier.key} not found, returning empty product. Error %O `, error);
      }
      return success(this.createEmptyProduct(payload.identifier.key));
    }
    return success(this.parseSingle(response.product));
  }

  @Reactionary({
    inputSchema: ProductQueryBySlugSchema,
    outputSchema: ProductSchema.nullable(),
  })
  public override async getBySlug(payload: ProductQueryBySlug): Promise<Result<Product, NotFoundError>> {
    const client = await this.client.getClient();
    if (debug.enabled) {
      debug(`Fetching product by slug: ${payload.slug}`);
    }

    const response = await client.store.product.list({
      handle: payload.slug,
      limit: 1,
      offset: 0,
      fields: '+metadata.*',
    });

    if (debug.enabled) {
      debug(`Found ${response.count} products for slug: ${payload.slug}`);
    }

    if (response.count === 0) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload
      });
    }
    return success(this.parseSingle(response.products[0]));
  }


  @Reactionary({
    inputSchema: ProductQueryBySKUSchema,
    outputSchema: ProductSchema,
  })
  public override async getBySKU(payload: ProductQueryBySKU): Promise<Result<Product>> {
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
    return success(this.parseSingle(product));
  }

  protected parseSingle(_body: StoreProduct): Product {
    const identifier = ProductIdentifierSchema.parse({ key: _body.id });
    const name = _body.title;
    const slug = _body.handle;
    const description = _body.description || '' || _body.subtitle || '';
    const parentCategories = [];
    parentCategories.push(
      ...
      _body.categories?.map( (cat) => cat.metadata?.['external_id'] ).map( (id) => CategoryIdentifierSchema.parse({ key: id || '' }) ) || []
    )
    const sharedAttributes = this.parseAttributes(_body);

    if (!_body.variants) {
      debug('Product has no variants', _body);
      throw new Error('Product has no variants ' + _body.id);
    }
    const mainVariant = this.parseVariant(_body.variants[0], _body);


    const otherVariants = [];
    if (_body.variants.length > 1) {
      otherVariants.push(
        ..._body.variants.slice(1).map( (variant) => this.parseVariant(variant, _body) )
      );
    }


    const meta = {
      cache: { hit: false, key: this.generateCacheKeySingle(identifier) },
      placeholder: false
    };

    const result = {
      brand: '',
      description,
      identifier,
      longDescription: '',
      mainVariant,
      manufacturer: '',
      meta,
      name,
      options: [],
      parentCategories,
      published: true,
      sharedAttributes,
      slug,
      variants: otherVariants,
    } satisfies Product;

    return result;
  }

  protected parseVariant(variant: StoreProductVariant, product: StoreProduct) {


    const options = (variant.options ?? []).map( (option) => {

      const optionId: ProductOptionIdentifier = { key: option.option_id || '' };
      const title = option.option?.title || '?';
      const valueIdentifier: ProductOptionValueIdentifier = { key: option.option_id || '', option: optionId };
      const value = option.value || '';

      const result: ProductVariantOption = {
        identifier: optionId,
        name: title,
        value: {
          identifier: valueIdentifier,
          label: value,
        },
      }
      return result;
    });


    const result: ProductVariant = {
      identifier: {
        sku: variant.sku || '',
      },
      name: variant.title || product.title,
      upc: variant.upc || '',
      ean: variant.ean || '',

      images: (product.images || []).map((img: StoreProductImage) => {
        return {
          sourceUrl: img.url,
          altText: variant.title || product.title || '',
        } satisfies Image;
      }),
      options: options,
      gtin: variant.ean ||  '',
      barcode: variant.ean || ''
    };

    return result;
  }

  protected createSynthAttribute(key: string, name: string, value: string ): ProductAttribute {
    const attributeIdentifier: ProductAttributeIdentifier = { key };
    const valueIdentifier: ProductAttributeValueIdentifier = { key: `${key}-${value}`};

    const attribute: ProductAttribute = {
      identifier: { key },
      name,
      group: '',
      values: [
        {
          identifier: valueIdentifier,
          label: String(value),
          value: value,
        }
      ]
    };
    return attribute;
  }

  protected parseAttributes(_body: StoreProduct): Array<ProductAttribute> {
    const sharedAttributes = [];

    if (_body.origin_country) {
      sharedAttributes.push(this.createSynthAttribute('origin_country', 'Origin Country', _body.origin_country));
    }

    if (_body.height) {
      sharedAttributes.push(this.createSynthAttribute('height', 'Height', String(_body.height)));
    }

    if (_body.weight) {
      sharedAttributes.push(this.createSynthAttribute('weight', 'Weight', String(_body.weight)));
    }

    if (_body.length) {
      sharedAttributes.push(this.createSynthAttribute('length', 'Length', String(_body.length)));
    }

    if (_body.width) {
      sharedAttributes.push(this.createSynthAttribute('width', 'Width', String(_body.width)));
    }

    if (_body.material) {
      sharedAttributes.push(this.createSynthAttribute('material', 'Material', _body.material));
    }
    if (_body.metadata) {
      for (const [key, value] of Object.entries(_body.metadata)) {
        sharedAttributes.push(this.createSynthAttribute(key, key, String(value)));
      }
    }
    return sharedAttributes;
  }
}

