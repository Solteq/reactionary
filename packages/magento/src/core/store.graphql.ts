/**
 * Storefront GraphQL documents for the store capability, built on MSI in-store
 * pickup (Magento_InventoryInStorePickupGraphQl). Pickup locations are public,
 * so these work with or without a customer token.
 */

const PICKUP_LOCATION_FIELDS = `
  pickup_location_code
  name
  description
  contact_name
  email
  phone
  latitude
  longitude
  street
  city
  postcode
  region
  country_id
`;

export const PICKUP_LOCATIONS_QUERY = `
  query ReactionaryPickupLocations($pageSize: Int!, $currentPage: Int!, $filters: PickupLocationFilterInput) {
    pickupLocations(pageSize: $pageSize, currentPage: $currentPage, filters: $filters) {
      items {
${PICKUP_LOCATION_FIELDS}
      }
      total_count
      page_info {
        current_page
        page_size
        total_pages
      }
    }
  }
`;
