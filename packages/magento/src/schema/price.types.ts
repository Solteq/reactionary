/** The `storeConfig` slice the price capability reads. */
export interface MagentoPriceStoreConfigResult {
  storeConfig?: {
    /** The website's base currency, in which catalog REST prices are kept. */
    base_currency_code?: string | null;
  } | null;
}

/** `/V1/company/{id}` (Adobe Commerce B2B), the fields the price capability reads. */
export interface MagentoCompany {
  id?: number;
  company_name?: string;
  vat_tax_id?: string | null;
  customer_group_id?: number;
}
