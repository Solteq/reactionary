import type {
  StoreProduct,
  StoreProductImage,
  StoreProductVariant,
} from '@medusajs/types';
import {
  CategoryIdentifierSchema,
  ProductIdentifierSchema,
  type AnyProductSchema,
  type Image,
  type Product,
  type ProductAttribute,
  type ProductAttributeIdentifier,
  type ProductAttributeValueIdentifier,
  type ProductFactory,
  type ProductOptionIdentifier,
  type ProductOptionValueIdentifier,
  type ProductSchema,
  type ProductVariant,
  type ProductVariantOption,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import createDebug from 'debug';

const debug = createDebug('reactionary:medusa:product');

export class MedusaProductFactory<
  TProductSchema extends AnyProductSchema = typeof ProductSchema,
> implements ProductFactory<TProductSchema>
{
  public readonly productSchema: TProductSchema;

  constructor(productSchema: TProductSchema) {
    this.productSchema = productSchema;
  }

  protected parseVariant(
    _context: RequestContext,
    variant: StoreProductVariant,
    product: StoreProduct,
  ) {
    const options = (variant.options ?? []).map((option) => {
      const optionId: ProductOptionIdentifier = { key: option.option_id || '' };
      const title = option.option?.title || '?';
      const valueIdentifier: ProductOptionValueIdentifier = {
        key: option.option_id || '',
        option: optionId,
      };
      const value = option.value || '';

      const result: ProductVariantOption = {
        identifier: optionId,
        name: title,
        value: {
          identifier: valueIdentifier,
          label: value,
        },
      };
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
      gtin: variant.ean || '',
      barcode: variant.ean || '',
    };

    return result;
  }

  protected createSynthAttribute(
    key: string,
    name: string,
    value: string,
  ): ProductAttribute {
    const attributeIdentifier: ProductAttributeIdentifier = { key };
    const valueIdentifier: ProductAttributeValueIdentifier = {
      key: `${key}-${value}`,
    };

    const attribute: ProductAttribute = {
      identifier: attributeIdentifier,
      name,
      group: '',
      values: [
        {
          identifier: valueIdentifier,
          label: String(value),
          value: value,
        },
      ],
    };
    return attribute;
  }

  protected parseAttributes(
    _context: RequestContext,
    _body: StoreProduct,
  ): Array<ProductAttribute> {
    const sharedAttributes = [];

    if (_body.origin_country) {
      sharedAttributes.push(
        this.createSynthAttribute(
          'origin_country',
          'Origin Country',
          _body.origin_country,
        ),
      );
    }

    if (_body.height) {
      sharedAttributes.push(
        this.createSynthAttribute('height', 'Height', String(_body.height)),
      );
    }

    if (_body.weight) {
      sharedAttributes.push(
        this.createSynthAttribute('weight', 'Weight', String(_body.weight)),
      );
    }

    if (_body.length) {
      sharedAttributes.push(
        this.createSynthAttribute('length', 'Length', String(_body.length)),
      );
    }

    if (_body.width) {
      sharedAttributes.push(
        this.createSynthAttribute('width', 'Width', String(_body.width)),
      );
    }

    if (_body.material) {
      sharedAttributes.push(
        this.createSynthAttribute('material', 'Material', _body.material),
      );
    }
    if (_body.metadata) {
      const keysToExclude = [
        'reactionaryaccessories',
        'reactionaryreplacements',
        'reactionaryspareparts',
      ];
      for (const [key, value] of Object.entries(_body.metadata)) {
        if (keysToExclude.includes(key)) {
          continue;
        }
        sharedAttributes.push(
          this.createSynthAttribute(key, key, String(value)),
        );
      }
    }
    return sharedAttributes;
  }

  public parseProduct(
    context: RequestContext,
    data: StoreProduct,
  ): z.output<TProductSchema> {
    const identifier = ProductIdentifierSchema.parse({
      key: data.external_id || data.id,
    });
    const name = data.title;
    const slug = data.handle;
    const description = data.description || '' || data.subtitle || '';
    const parentCategories = [];
    parentCategories.push(
      ...(data.categories
        ?.map((cat) => cat.metadata?.['external_id'])
        .map((id) => CategoryIdentifierSchema.parse({ key: id || '' })) || []),
    );
    const sharedAttributes = this.parseAttributes(context, data);

    if (!data.variants) {
      debug('Product has no variants', data);
      throw new Error('Product has no variants ' + data.external_id);
    }
    const mainVariant = this.parseVariant(context, data.variants[0], data);

    const otherVariants = [];
    if (data.variants.length > 1) {
      otherVariants.push(
        ...data.variants
          .slice(1)
          .map((variant) => this.parseVariant(context, variant, data)),
      );
    }

    const result = {
      brand: '',
      description,
      identifier,
      longDescription: '',
      mainVariant,
      manufacturer: '',
      name,
      options: [],
      parentCategories,
      published: true,
      sharedAttributes,
      slug,
      variants: otherVariants,
    } satisfies Product;

    return this.productSchema.parse(result);
  }
}
