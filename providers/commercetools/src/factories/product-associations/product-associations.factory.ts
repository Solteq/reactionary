import type { ProductProjection, ProductVariant as CTProductVariant } from '@commercetools/platform-sdk';
import {
  ImageSchema,
  ProductAssociationSchema,
  ProductOptionIdentifierSchema,
  ProductSearchResultItemVariantSchema,
  ProductVariantIdentifierSchema,
  ProductVariantOptionSchema,
  type AnyProductAssociationSchema,
  type ProductAssociation,
  type ProductAssociationsFactory,
  type ProductOptionIdentifier,
  type ProductSearchResultItem,
  type ProductSearchResultItemVariant,
  type ProductVariantIdentifier,
  type ProductVariantOption,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class CommercetoolsProductAssociationsFactory<
  TProductAssociationSchema extends AnyProductAssociationSchema = typeof ProductAssociationSchema,
> implements ProductAssociationsFactory<TProductAssociationSchema>
{
  public readonly productAssociationSchema: TProductAssociationSchema;

  constructor(productAssociationSchema: TProductAssociationSchema) {
    this.productAssociationSchema = productAssociationSchema;
  }

  public parseAssociation(
    context: RequestContext,
    data: {
      sourceProductKey: string;
      relation: 'accessory' | 'sparepart' | 'replacement';
      product: ProductProjection;
    },
  ): z.output<TProductAssociationSchema> {
    const product = this.parseSearchResultItem(context, data.product);
    const result = {
      associationIdentifier: {
        key: `${data.sourceProductKey}-${data.relation}-${product.identifier.key}`,
      },
      associationReturnType: 'productSearchResultItem',
      product,
    } satisfies ProductAssociation;

    return this.productAssociationSchema.parse(result);
  }

  protected parseSearchResultItem(
    context: RequestContext,
    data: ProductProjection,
  ): ProductSearchResultItem {
    const variants = [data.masterVariant, ...data.variants].map((variant) =>
      this.parseVariant(context, variant, data),
    );

    return {
      identifier: { key: data.id },
      name: data.name[context.languageContext.locale] || data.id,
      slug: data.slug?.[context.languageContext.locale] || data.id,
      variants,
    } satisfies ProductSearchResultItem;
  }

  protected parseVariant(
    context: RequestContext,
    variant: CTProductVariant,
    product: ProductProjection,
  ): ProductSearchResultItemVariant {
    const sourceImage = variant.images?.[0];
    const image = ImageSchema.parse({
      sourceUrl: sourceImage?.url || '',
      height: sourceImage?.dimensions.h || undefined,
      width: sourceImage?.dimensions.w || undefined,
      altText: sourceImage?.label || product.name[context.languageContext.locale] || undefined,
    });

    const mappedOptions =
      variant.attributes
        ?.filter((attribute) => attribute.name === 'Color')
        .map((option) =>
          ProductVariantOptionSchema.parse({
            identifier: ProductOptionIdentifierSchema.parse({
              key: option.name,
            } satisfies Partial<ProductOptionIdentifier>),
            name: option.value || '',
          } satisfies Partial<ProductVariantOption>),
        ) || [];

    const mappedOption = mappedOptions?.[0];

    return ProductSearchResultItemVariantSchema.parse({
      variant: ProductVariantIdentifierSchema.parse({
        sku: variant.sku || '',
      } satisfies ProductVariantIdentifier),
      image,
      options: mappedOption,
    } satisfies Partial<ProductSearchResultItemVariant>);
  }
}
