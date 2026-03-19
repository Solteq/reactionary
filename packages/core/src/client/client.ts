import type { ProductCapability } from "../capabilities/product.capability.js";
import type { ProductSearchCapability } from "../capabilities/product-search.capability.js";
import type { IdentityCapability } from '../capabilities/identity.capability.js';
import type { CartCapability } from "../capabilities/cart.capability.js";
import type { PriceCapability } from "../capabilities/price.capability.js";
import type { InventoryCapability } from "../capabilities/inventory.capability.js";
import type { Cache } from "../cache/cache.interface.js";
import type { CategoryCapability } from "../capabilities/category.capability.js";
import type { AnalyticsCapability, CheckoutCapability, OrderCapability, CompanyCapability, EmployeeCapability, CompanyRegistrationCapability, ProductListCapability, ProfileCapability, StoreCapability } from "../capabilities/index.js";
import type { OrderSearchCapability } from "../capabilities/order-search.capability.js";
import type { ProductRecommendationsCapability } from "../capabilities/product-recommendations.capability.js";
import type { ProductAssociationsCapability } from "../capabilities/product-associations.capability.js";
import type { ProductReviewsCapability } from "../capabilities/product-reviews.capability.js";
import type { EmployeeInvitationCapability } from "../capabilities/employee-invitation.capability.js";

export interface Client {
    product: ProductCapability,
    productSearch: ProductSearchCapability,
    productRecommendations: ProductRecommendationsCapability,
    productAssociations: ProductAssociationsCapability,
    productReviews: ProductReviewsCapability,
    productList: ProductListCapability,
    identity: IdentityCapability,
    cache: Cache,
    cart: CartCapability,
    checkout: CheckoutCapability,
    analytics: AnalyticsCapability,
    price: PriceCapability,
    inventory: InventoryCapability,
    category: CategoryCapability,
    profile: ProfileCapability,
    store: StoreCapability,
    order: OrderCapability,
    orderSearch: OrderSearchCapability,
    companyRegistration: CompanyRegistrationCapability,
    employee: EmployeeCapability,
    company: CompanyCapability,
    employeeInvitation: EmployeeInvitationCapability,
}

