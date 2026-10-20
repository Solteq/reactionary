import type { MagentoClient } from './client.js';
import type {
  MagentoCompany,
  MagentoPriceStoreConfigResult,
} from '../schema/price.types.js';

export const PRICE_STORE_CONFIG_QUERY = `
  query ReactionaryPriceStoreConfig {
    storeConfig {
      base_currency_code
    }
  }
`;

/** The store view's base currency code, read anonymously over GraphQL. */
export async function getStoreBaseCurrencyCode(
  magentoApi: MagentoClient,
): Promise<string | undefined> {
  const result = await magentoApi.graphqlRequest<MagentoPriceStoreConfigResult>(
    PRICE_STORE_CONFIG_QUERY,
  );
  return result.storeConfig?.base_currency_code ?? undefined;
}

/**
 * A B2B company, read with the admin token. Only call it with the company id
 * taken from the signed-in customer's own record, never a caller-supplied id.
 */
export function getCompanyOfCustomer(
  magentoApi: MagentoClient,
  companyId: number,
): Promise<MagentoCompany> {
  return magentoApi.adminRequest<MagentoCompany>(
    'GET',
    `/V1/company/${encodeURIComponent(String(companyId))}`,
  );
}
