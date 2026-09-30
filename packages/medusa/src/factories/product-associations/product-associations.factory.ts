import type { StoreProduct, StoreProductVariant } from '@medusajs/types';
import {
  ImageSchema,
  ProductSearchResultItemComplianceDataSchema,
  ProductSearchResultItemVariantSchema,
  ProductVariantIdentifierSchema,
  type AnyProductAssociationSchema,
  type ProductAssociation,
  type ProductAssociationSchema,
  type ProductAssociationsFactory,
  type ProductAssociationsIdentifier,
  type ProductSearchResultItem,
  type ProductSearchResultItemComplianceData,
  type ProductSearchResultItemVariant,
  type ProductVariantIdentifier,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import { safeBoolConvert, safeStringConvert } from '../../utils/medusa-helpers.js';

export interface MedusaProductAssociationFactoryInput {
  product: StoreProduct,
  identifier: ProductAssociationsIdentifier
}

export class MedusaProductAssociationsFactory<
  TProductAssociationSchema extends AnyProductAssociationSchema = typeof ProductAssociationSchema,
> implements ProductAssociationsFactory<TProductAssociationSchema>
{
  public readonly productAssociationSchema: TProductAssociationSchema;

  constructor(productAssociationSchema: TProductAssociationSchema) {
    this.productAssociationSchema = productAssociationSchema;
  }

  public parseAssociation(
    context: RequestContext,
    data: MedusaProductAssociationFactoryInput,
  ): z.output<TProductAssociationSchema> {

    const heroVariant = data.product.variants?.[0];
    const identifier = { key: data.product.external_id || data.product.id};
    const slug = data.product.handle;
    const name = heroVariant?.title || data.product.title;
    const variants = [];
    if (heroVariant) {
      variants.push(this.parseVariant(context, heroVariant, data.product));
    }

    const searchItemResult = {
      identifier,
      name,
      slug,
      variants,
      complianceData: this.parseComplianceData(data.product),
    } satisfies ProductSearchResultItem;

    const result = {
      associationIdentifier: data.identifier,
      associationReturnType: 'productSearchResultItem',
      product: searchItemResult,
    } satisfies ProductAssociation;

    return this.productAssociationSchema.parse(result);
  }

  protected parseComplianceData(product: StoreProduct): ProductSearchResultItemComplianceData {
    const data = product;
    // Implement parsing logic for compliance data if needed
    if (!data.metadata) {
      return ProductSearchResultItemComplianceDataSchema.parse({});
    }
    const complianceData = {
      ce_marking: safeBoolConvert(data.metadata?.['compliance_data_ce_marking']),
      weee_symbol: safeBoolConvert(data.metadata?.['compliance_data_weee_symbol']),
      energy_class: safeStringConvert(data.metadata?.['compliance_data_energy_class']),
      garan_label: safeStringConvert(data.metadata?.['compliance_data_garan_label']),
      is_organic: safeBoolConvert(data.metadata?.['compliance_data_organic_is_organic']),
      organic_certification_type: safeStringConvert(data.metadata?.['compliance_data_organic_certification_type']),
    };
    return ProductSearchResultItemComplianceDataSchema.parse(complianceData);
  }

  protected parseVariant(
    _context: RequestContext,
    variant: StoreProductVariant,
    product: StoreProduct
  ): ProductSearchResultItemVariant {
    const img = ImageSchema.parse({
      sourceUrl: product.images?.[0].url ?? '',
      altText: product.title || undefined,
    });

    return ProductSearchResultItemVariantSchema.parse({
      variant: ProductVariantIdentifierSchema.parse({
        sku: variant.sku || '',
      } satisfies ProductVariantIdentifier),
      image: img,
    } satisfies Partial<ProductSearchResultItemVariant>);
  }
}
