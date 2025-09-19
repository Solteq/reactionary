import { Currency } from '../schemas/models/currency.model';
import { Price } from '../schemas/models/price.model';
import { PriceQueryBySku } from '../schemas/queries/price.query';
import { RequestContext } from '../schemas/session.schema';
import { BaseProvider } from './base.provider';

export abstract class PriceProvider<
  T extends Price = Price
> extends BaseProvider<T> {


  /**
   * Get a price by SKU.
   *
   * Note: This does not include any discounts or promotions that may apply.
   * For B2B scenarios, this will be the base price, and any customer specific pricing
   *
   * Usecase: You are rendering a product page, and you need to show the price for a SKU.
   * @param payload The SKU to query
   * @param session The session information
   */
  public abstract getBySKU(payload: PriceQueryBySku, reqCtx: RequestContext): Promise<T>;


  /**
   * Fetch prices for multiple SKUs in one go.
   *
   * Usecase: You are rendering a product grid, and you need to show prices for multiple SKUs.
   * @param payload The SKUs to query
   * @param session The session information
   */
  public abstract getBySKUs(payload: PriceQueryBySku[], reqCtx: RequestContext): Promise<T[]>;


  /**
   * Utility function to create an empty price result, with a value of -1.
   * This is used when no price is found for a given SKU + currency combination.
   * You should check for meta.placeholder to see if this is a real price or a placeholder.
   * @param sku
   * @param currency
   * @returns
   */
  protected createEmptyPriceResult(sku: string, currency: Currency): T {
    const base = this.newModel();
    base.identifier = {
      sku: { key: sku }
    };
    base.unitPrice = {
      value: -1,
      currency: currency,
    };
    base.meta = {
      cache: { hit: false, key: `price-${sku}-${currency}` },
      placeholder: true
    };
    return this.assert(base);
  }



  protected override getResourceName(): string {
    return 'price';
  }
}
