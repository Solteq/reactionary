import type { NotFoundError } from "../index.js";
import type { OrganizationalEntity, OrganizationalEntityRegistrationStatus } from "../schemas/models/organizational-entity.model.js";
import type { Result } from "../schemas/result.js";
import { BaseCapability } from "./base.capability.js";

export abstract class OrganizationalEntityProvider extends BaseCapability {

  protected override getResourceName(): string {
    return 'organizational-entity';
  }

  /**
   *
   * Usecase: Fetch organization info such as name, default contact person, etc, based on the organization identifier in the request context.
   * This can be used to render organization-specific information in the storefront
   *
   * @param payload
   */
  public abstract getById( payload: OrganizationalEntityQueryById ): Promise<Result<OrganizationalEntity>>;

  /**
   * Usecase:
   * If site supports self-registration of organizational entities, this method can be used to register a new organizational entity. Depending on backend, it might require
   * additional offline steps (email verification, manual approval, etc) before the organizational entity can be used to log in and access organizational-entity-specific features.
   * @param payload
   */
  public abstract registerOrganizationalEntity( payload: OrganizationalEntityMutationRegister ): Promise<Result<OrganizationalEntityRegistrationStatus>>;


  /**
   * Usecase: After registration, if it takes a while (say, if it requires manual approval), the storefront can present the customer with a url with the
   * registration request identifier in it, to allow the customer to check periodically the status of their organizational entity registration, and show appropriate messages (e.g. "your registration is pending approval", "your registration was denied, contact support for more info", etc)
   * @param payload
   */
  public abstract checkOrganizationalEntityRegistrationStatus( payload: OrganizationalEntityQueryCheckRegistrationStatus ): Promise<Result<OrganizationalEntityRegistrationStatus>>;


  /**
   * Updates the base information of the organizational entity.
   * Typically, there is not alot that the user can change himself, if the data is governed from ERP
   *
   * Usecase: Update the user's name, email, or phone number.
   *
   * NOTE: For now, we are not exposing an update method for organizational entities, as its not super clear
   * WHAT we'd typically allow them to change on their own. Most of the time, this kind of thing comes from the customer-master
   *
   * @param payload
  public abstract update(payload: OrganizationalEntityMutationUpdate): Promise<Result<OrganizationEntity, NotFoundError>>;
   */

  /**
   * Creates a new shipping address for the currently authenticated (registered) user.
   * Does not set it as default automatically.
   *
   * Usecase: User adds a new shipping address in their profile or during checkout. Ideally, any address manipulation
   * done at checkout should be considered local to that session, unless the addressbook is empty.
   * @param payload
   */
  public abstract addShippingAddress(payload: OrganizationalEntityMutationAddShippingAddress): Promise<Result<OrganizationEntity, NotFoundError>>;

  /**
   * Updates an existing shipping address for the organizational entity (if allowed by backend).
   *
   * Usecase: User edits shipping address on organizational tab in my-account page. Either the default one, or one of the alternates
   * @param payload
   */
  public abstract updateShippingAddress(payload: OrganizationalEntityMutationUpdateShippingAddress): Promise<Result<OrganizationEntity, NotFoundError>>;

  /**
   * Removes an existing shipping address for the organizational entity (if allowed by backend).
   * If the removed address was the default shipping address, the default shipping address is set to a random other address.
   *
   * Usecase: User deletes a shipping address from their business profile.
   * @param payload
   */
  public abstract removeShippingAddress(payload: OrganizationalEntityMutationRemoveShippingAddress): Promise<Result<OrganizationEntity, NotFoundError>>;

  /**
   * Configures an existing shipping address as the default shipping address for the organizational entity (if allowed by backend).
   *
   * Usecase: User selects a default shipping address in their business profile.
   * @param payload
   */
  public abstract makeShippingAddressDefault(payload: OrganizationalEntityMutationMakeShippingAddressDefault): Promise<Result<OrganizationEntity, NotFoundError>>;

  /**
   * Sets the current/active billing address for the organizational entity
   *
   * Usecase: User sets or updates their billing address in their business profile
   *
   * It was a design decision not to support multiple billing addresses. The billing address represents who you are as the commercial
   * entity being billed, and as such it makes sense to have a single authoritative billing address.
   * @param payload
   *
   * NOTE: We are not exposing this for now, as we expect the billing address to be managed from the ERP side
  public abstract setBillingAddress(payload: OrganizationalEntityMutationSetBillingAddress): Promise<Result<OrganizationEntity, NotFoundError>>;
   */


  /**
   * Create an empty organization object with the given id. This can be used as a fallback when organization is not found, to avoid returning null and causing errors in the storefront.
   * The storefront can then check if the returned organization has an empty name or other fields to determine if it is a valid organization or a fallback.
   * @param id
   */
  protected createEmptyOrganizationalEntity(id: string): OrganizationalEntity {
    const organization = {
      identifier: {
        taxIdentifier: id
      },
      name: "",
      status: "pending",
      pointOfContact: {
        email: "",
        phone: undefined
      },
      billingAddress: {
        firstName: "",
        lastName: "",
        streetAddress: "",
        streetNumber: "",
        city: "",
        region: "",
        postalCode: "",
        countryCode: "",
        identifier: {
          nickName: 'default'
        }
      },
      alternateShippingAddresses: [],
      isCustomAddressesAllowed: false,
      isSelfManagementOfShippingAddressesAllowed: false
    } satisfies OrganizationalEntity;
    return organization;
  }
