import type { ProfileCapability } from '../capabilities/profile.capability.js';
import type { Identity } from '../schemas/models/identity.model.js';

export type ApplyExternalLoginProfileOptions = {
  /**
   * Write the phone number only when the identity provider says it verified it (phone_number_verified). Defaults to true:
   * providers that let people type any phone number would otherwise put unchecked numbers on the profile. Set to false for
   * a provider you trust, or one that verifies phones without saying so. The address claim has no verified flag and is always
   * written, since an address is not proof of anything.
   */
  requireVerifiedPhone?: boolean;
  /** Called when a write fails. The login has succeeded either way, so nothing is thrown. Defaults to console.warn, as the rest of core reports. */
  onError?: (message: string, error: unknown) => void;
};

/**
 * Puts what an external login learned about a new customer on their profile: the phone number, and the address as
 * the billing address. Backends create the customer with the email and names only, and the profile is the same
 * for every backend, so this is the one place that writes the rest.
 *
 * Does nothing unless the login created the customer (`isNewCustomer`), which is what keeps what the shopper later
 * edits from being overwritten: calling it again after a later login writes nothing. Each write is best effort and
 * failures are reported through `onError`, never thrown.
 */
export async function applyExternalLoginProfile(
  client: { profile: Pick<ProfileCapability, 'getById' | 'update' | 'setBillingAddress'> },
  identity: Identity,
  options: ApplyExternalLoginProfileOptions = {},
): Promise<void> {
  if (identity.type !== 'Registered' || !identity.externalLogin?.isNewCustomer) {
    return;
  }
  const { requireVerifiedPhone = true, onError = (message, error) => console.warn(message, error) } = options;
  const { profile } = identity.externalLogin;
  const identifier = identity.id;

  const attempt = async (what: string, run: () => Promise<{ success: boolean; error?: unknown }>) => {
    try {
      const result = await run();
      if (!result.success) {
        onError(`Could not ${what} after external login`, result.error);
      }
    } catch (error) {
      onError(`Could not ${what} after external login`, error);
    }
  };

  const phone = profile.phone;
  if (phone && (!requireVerifiedPhone || profile.phoneVerified === true)) {
    await attempt('save the phone number', async () => {
      // The update needs an email as well; the claims have it unless the backend already stored a different one
      let email = profile.email;
      if (!email) {
        const current = await client.profile.getById({ identifier });
        email = current.success ? current.value.email : undefined;
      }
      if (!email) {
        return { success: false, error: 'No email address for the profile' };
      }
      return client.profile.update({ identifier, email, phone });
    });
  }

  const address = profile.billingAddress;
  if (address) {
    await attempt('save the billing address', () => client.profile.setBillingAddress({ identifier, address }));
  }
}
