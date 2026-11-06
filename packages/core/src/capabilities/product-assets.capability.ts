import type { ProductAsset, ProductAssetType } from '../schemas/models/product-assets.model.js';
import type { ProductAssetsGetQuery } from '../schemas/queries/product-assets.query.js';
import type { Result } from '../schemas/result.js';
import { BaseCapability } from './base.capability.js';

/**
 * The product assets capability looks up the non-gallery assets of a product: manuals, user guides, certificates,
 * warranties, safety data sheets, energy labels, videos, 3D models and the like.
 *
 * The assets may come from the commerce backend or from a dedicated DAM. Where one source document covers several
 * products (a manual for a whole product family), that is a backend concern: the asset is simply returned for every
 * product it applies to, under the same identifier key.
 *
 * Each asset is a logical asset with one or more files (renditions): the same manual in several languages, or a 3D
 * model as glb and usdz. All file URLs are absolute, whatever the storage.
 *
 * Caching: results are cached by default. Providers that serve signed or expiring URLs must disable caching or keep
 * the cache lifetime below the URL lifetime.
 */
export abstract class ProductAssetsCapability<
  TProductAsset extends ProductAsset = ProductAsset,
> extends BaseCapability {
  /**
   * Returns the assets of a product. Product-level assets are always included. When the query names a variant, the
   * assets of that variant are included too; an asset present on both is returned once.
   *
   * Usecase:
   * - PDP: documents, videos and 3D models for the product
   */
  public abstract getAssets(query: ProductAssetsGetQuery): Promise<Result<TProductAsset[]>>;

  /**
   * Maps a source-specific type (a usage code, tag or attribute name) to the asset type. Unmapped values become
   * 'other'. The raw value is returned as vendorType so nothing is lost.
   */
  protected mapVendorType(
    vendorType: string | undefined,
    typeMap: Readonly<Record<string, ProductAssetType>>,
  ): { type: ProductAssetType; vendorType: string | undefined } {
    if (vendorType === undefined) {
      return { type: 'other', vendorType };
    }
    const type = Object.hasOwn(typeMap, vendorType) ? typeMap[vendorType] : undefined;
    return { type: type ?? 'other', vendorType };
  }

  /**
   * Removes duplicate assets by identifier key. The first occurrence wins, so list the more specific source
   * (e.g. the variant) first if its version should be preferred.
   */
  protected dedupeAssets<T extends ProductAsset>(assets: readonly T[]): T[] {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const asset of assets) {
      if (seen.has(asset.identifier.key)) {
        continue;
      }
      seen.add(asset.identifier.key);
      result.push(asset);
    }
    return result;
  }

  /**
   * Applies the optional type filter of a query.
   */
  protected filterByTypes<T extends ProductAsset>(assets: readonly T[], types: readonly ProductAssetType[] | undefined): T[] {
    if (!types || types.length === 0) {
      return [...assets];
    }
    return assets.filter((asset) => types.includes(asset.type));
  }

  getResourceName(): string {
    return 'product-assets';
  }
}
