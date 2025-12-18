import type { InvalidInputError, NotFoundError } from '../schemas/index.js';
import type { Profile } from '../schemas/models/index.js';
import type { ProfileMutationAddShippingAddress, ProfileMutationMakeShippingAddressDefault, ProfileMutationRemoveShippingAddress, ProfileMutationSetBillingAddress, ProfileMutationUpdate, ProfileMutationUpdateShippingAddress } from '../schemas/mutations/index.js';
import type { ProfileQuerySelf as ProfileQueryById } from '../schemas/queries/index.js';
import type { Result } from '../schemas/result.js';
import { BaseProvider } from './base.provider.js';

export abstract class ProfileProvider extends BaseProvider {

  /**
   * Returns the profile of the currently authenticated (registered) user.
   *
   * Usecase: Fetch the profile of the logged-in user for display in header, or account settings.
   * @param payload
   */
  public abstract getById(payload: ProfileQueryById): Promise<Result<Profile, NotFoundError>>;

  /**
   * Updates the base profile information of the currently authenticated (registered) user.
   *
   * TODO: This should include first/lastname.
   * TODO: In some systems, updating email/phone may require re-verification.
   * TODO: Handle conflicts if email/phone is already in use by another user.
   * TODO: In some systems the email might not be editable.
   *
   * Usecase: Update the user's name, email, or phone number.
   * @param payload
   */
  public abstract update(payload: ProfileMutationUpdate): Promise<Result<Profile, NotFoundError>>;

  /**
   * Creates a new shipping address for the currently authenticated (registered) user.
   * Does not set it as default automatically.
   *
   * Usecase: User adds a new shipping address in their profile or during checkout. Ideally, any address manipulation
   * done at checkout should be considered local to that session, unless the addressbook is empty.
   * @param payload
   */
  public abstract addShippingAddress(payload: ProfileMutationAddShippingAddress): Promise<Result<Profile, NotFoundError>>;

  /**
   * Updates an existing shipping address for the currently authenticated (registered) user.
   *
   * Usecase: User edits an existing shipping address in their profile. Ideally, any address manipulation
   * done at checkout should be considered local to that session/order, unless the addressbook is empty.
   * @param payload
   */
  public abstract updateShippingAddress(payload: ProfileMutationUpdateShippingAddress): Promise<Result<Profile, NotFoundError>>;

  /**
   * Removes an existing shipping address for the currently authenticated (registered) user.
   *
   * If the removed address was the default shipping address, the default shipping address is set to a random other address.
   *
   * Usecase: User deletes a shipping address from their profile.
   * @param payload
   */
  public abstract removeShippingAddress(payload: ProfileMutationRemoveShippingAddress): Promise<Result<Profile, NotFoundError>>;

  /**
   * Configures an existing shipping address as the default shipping address for the currently authenticated (registered) user.
   *
   * Usecase: User selects a default shipping address in their profile.
   * @param payload
   */
  public abstract makeShippingAddressDefault(payload: ProfileMutationMakeShippingAddressDefault): Promise<Result<Profile, NotFoundError>>;

  /**
   * Sets the current/active billing address for the currently authenticated (registered) user.
   *
   * Usecase: User sets or updates their billing address in their profile or during checkout.
   *
   * It was a design decision not to support multiple billing addresses. The billing address represents who you are as the commercial
   * entity being billed, and as such it makes sense to have a single authoritative billing address.
   * @param payload
   */
  public abstract setBillingAddress(payload: ProfileMutationSetBillingAddress): Promise<Result<Profile, NotFoundError>>;

  protected override getResourceName(): string {
    return 'profile';
  }
}
