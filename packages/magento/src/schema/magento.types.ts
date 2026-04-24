export interface MagentoCustomAttribute {
  attribute_code: string;
  value: unknown;
}

export interface MagentoCategoryLink {
  position: number;
  category_id: string;
}

export interface MagentoMediaGalleryEntry {
  id: number;
  media_type: string;
  label: string | null;
  position: number;
  disabled: boolean;
  types: string[];
  file: string;
}

export interface MagentoTierPrice {
  customer_group_id: number;
  qty: number;
  value: number;
  extension_attributes?: Record<string, unknown>;
}

export interface MagentoExtensionAttributes {
  category_links?: MagentoCategoryLink[];
  website_ids?: number[];
  stock_item?: MagentoStockItem;
  [key: string]: unknown;
}

export interface MagentoStockItem {
  item_id: number;
  product_id: number;
  stock_id: number;
  qty: number;
  is_in_stock: boolean;
  is_qty_decimal: boolean;
  min_qty: number;
  min_sale_qty: number;
  max_sale_qty: number;
}

export interface MagentoCartItem {
  item_id: number;
  sku: string;
  qty: number;
  name?: string;
  price: number;
  product_type?: string;
  quote_id?: string;
  discount_amount?: number;
  row_total?: number;
  row_total_incl_tax?: number;
  tax_amount?: number;
  tax_percent?: number;
  extension_attributes?: Record<string, unknown>;
}

export interface MagentoCartCustomer {
  id?: number;
  group_id?: number;
  email?: string;
  firstname?: string;
  lastname?: string;
}

export interface MagentoCart {
  id: number;
  masked_id?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
  is_virtual?: boolean;
  items: MagentoCartItem[];
  items_count?: number;
  items_qty?: number;
  customer: MagentoCartCustomer;
  billing_address?: Record<string, unknown>;
  currency?: {
    global_currency_code?: string;
    base_currency_code?: string;
    quote_currency_code?: string;
    store_currency_code?: string;
  };
  quote_currency_code?: string;
  name?: string;
  description?: string;
  subtotal?: number;
  base_subtotal?: number;
  grand_total?: number;
  base_grand_total?: number;
  tax_amount?: number;
  base_tax_amount?: number;
  shipping_amount?: number;
  base_shipping_amount?: number;
  discount_amount?: number;
  base_discount_amount?: number;
  coupon_code?: string;
  extension_attributes?: Record<string, unknown>;
  /** Synthetic property injected by the capability with the requested cart identifier */
  _requestedId?: string;
}

export interface MagentoCategory {
  id: number;
  parent_id: number;
  name: string;
  is_active?: boolean;
  position?: number;
  level?: number;
  product_count?: number;
  children_data?: MagentoCategory[];
  custom_attributes?: MagentoCustomAttribute[];
  created_at?: string;
  updated_at?: string;
  path?: string;
  include_in_menu?: boolean;
}

export interface MagentoCategorySearchResult {
  items: MagentoCategory[];
  total_count: number;
  search_criteria?: Record<string, unknown>;
}

export interface MagentoIdentity {
  id: number;
  group_id?: number;
  default_billing?: string;
  default_shipping?: string;
  email: string;
  firstname: string;
  lastname: string;
  store_id?: number;
  website_id?: number;
  created_at?: string;
  updated_at?: string;
  addresses?: MagentoAddress[];
  extension_attributes?: Record<string, unknown>;
  custom_attributes?: MagentoCustomAttribute[];
}

export interface MagentoAddress {
  id?: number;
  customer_id?: number;
  firstname: string;
  lastname: string;
  street: string[];
  city: string;
  region?: {
    region_code: string;
    region: string;
    region_id: number;
  };
  postcode: string;
  country_id: string;
  telephone?: string;
  default_billing?: boolean;
  default_shipping?: boolean;
}

export interface MagentoStockStatus {
  product_id: number;
  stock_id: number;
  qty: number;
  stock_status: number;
}

export interface MagentoSourceItem {
  sku: string;
  source_code: string;
  quantity: number;
  status: number;
}

export interface MagentoInventory {
  stock_item?: MagentoStockStatus;
  source_items?: MagentoSourceItem[];
}

export interface MagentoPrice {
  price: number;
  special_price?: number | null;
  special_from_date?: string | null;
  special_to_date?: string | null;
  tier_prices?: MagentoTierPrice[];
  custom_attributes?: MagentoCustomAttribute[];
}

export interface MagentoProduct {
  id: number;
  sku: string;
  name: string;
  attribute_set_id?: number;
  price?: number;
  status?: number;
  visibility?: number;
  type_id?: string;
  created_at?: string;
  updated_at?: string;
  weight?: number;
  extension_attributes?: MagentoExtensionAttributes;
  product_links?: Array<Record<string, unknown>>;
  options?: Array<Record<string, unknown>>;
  media_gallery_entries?: MagentoMediaGalleryEntry[];
  tier_prices?: MagentoTierPrice[];
  custom_attributes?: MagentoCustomAttribute[];
}

export interface MagentoProductSearchResult {
  items: MagentoProduct[];
  search_criteria?: Record<string, unknown>;
  total_count: number;
}
