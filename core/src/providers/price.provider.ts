import type { Price } from '../schemas/models/price.model.js';
import type { CustomerPriceQuery, ListPriceQuery } from '../schemas/queries/price.query.js';
import { BaseProvider } from './base.provider.js';

export abstract class PriceProvider<
  T extends Price = Price
> extends BaseProvider<T> {

  /**
   * Get a list price price by SKU. This is the most general, undiscounted price and is typically
   * used as the "before" price in most ecommerce setups.
   *
   * Usecase: You are rendering a product page, and you need to show the price for a SKU.
   * @param payload The SKU to query
   * @param session The session information
   */
  public abstract getListPrice(payload: ListPriceQuery): Promise<T>;

  /**
   * Get a customer-specific price by SKU.
   * 
   * No
   *
   * Usecase: You are rendering a product page, and you need to show the price for a SKU.
   * @param payload The SKU to query
   * @param session The session information
   */
  public abstract getCustomerPrice(payload: CustomerPriceQuery): Promise<T>;


  /**
   * Utility function to create an empty price result, with a value of -1.
   * This is used when no price is found for a given SKU + currency combination.
   * You should check for meta.placeholder to see if this is a real price or a placeholder.
   * @param sku
   * @param currency
   * @returns
   */
  protected createEmptyPriceResult(sku: string): T {
    const base = this.newModel();
    base.identifier = {
      variant: { sku: sku }
    };
    base.unitPrice = {
      value: -1,
      currency: this.context.languageContext.currencyCode,
    };
    base.meta = {
      cache: { hit: false, key: `price-${sku}-${this.context.languageContext.currencyCode}` },
      placeholder: true
    };
    return this.assert(base);
  }



  protected override getResourceName(): string {
    return 'price';
  }
}
