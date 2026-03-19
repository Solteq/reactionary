import type { CompanyRegistrationRequest } from "../schemas/models/company-registration.model.js";
import type { CompanyRegistrationMutationRegister } from "../schemas/mutations/company-registration.mutation.js";
import type { CompanyRegistrationQueryCheckRegistrationStatus } from "../schemas/queries/company-registration.query.js";
import type { Result } from "../schemas/result.js";
import { BaseCapability } from "./base.capability.js";

export abstract class CompanyRegistrationCapability extends BaseCapability {

  protected override getResourceName(): string {
    return 'company-registration';
  }

  /**
   * Usecase:
   * If site supports self-registration of organizational entities, this method can be used to register a new organizational entity. Depending on backend, it might require
   * additional offline steps (email verification, manual approval, etc) before the organizational entity can be used to log in and access company-specific features.
   * @param payload
   */
  public abstract requestRegistration( payload: CompanyRegistrationMutationRegister ): Promise<Result<CompanyRegistrationRequest>>;


  /**
   * Usecase: After registration, if it takes a while (say, if it requires manual approval), the storefront can present the customer with a url with the
   * registration request identifier in it, to allow the customer to check periodically the status of their organizational entity registration, and show appropriate messages (e.g. "your registration is pending approval", "your registration was denied, contact support for more info", etc)
   * @param payload
   */
  public abstract checkRequestStatus( payload: CompanyRegistrationQueryCheckRegistrationStatus ): Promise<Result<CompanyRegistrationRequest>>;


}
