import type { ProfileCapability } from '../capabilities/profile.capability.js';
import type { Identity } from '../schemas/models/identity.model.js';

/**
 * Puts what an external login learned about a new customer on their profile: the phone number, and the address as
 * the billing address. Backends create the customer with the email and names only, and the profile is the same
 * for every backend, so this is the one place that writes the rest.
 *
 * Does nothing unless the login created the customer, so what the shopper later edits is never overwritten. Each write is
 * best effort: the login has succeeded whether or not the profile could be updated, so failures are reported through
 * `onError` (console.warn by default) and never thrown.
 */
export async function applyExternalLoginProfile(
  client: { profile: Pick<ProfileCapability, 'getById' | 'update' | 'setBillingAddress'> },
  identity: Identity,
  onError: (message: string, error: unknown) => void = (message, error) => console.warn(message, error),
): Promise<void> {
  if (identity.type !== 'Registered' || !identity.externalLogin?.isNewCustomer) {
    return;
  }
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

  if (profile.phone) {
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
      return client.profile.update({ identifier, email, phone: profile.phone as string });
    });
  }

  if (profile.billingAddress) {
    const address = profile.billingAddress;
    await attempt('save the billing address', () => client.profile.setBillingAddress({ identifier, address }));
  }
}
