import {
  type Identity,
  type IdentityMutationLogin,
  type IdentityMutationLogout,
  type IdentityMutationRegister,
  type IdentityQuerySelf,
  type InvalidInputError,
  type RequestContext,
  type Cache,
  IdentityCapability,
  Reactionary,
  IdentityQuerySelfSchema,
  IdentitySchema,
  IdentityMutationRegisterSchema,
  IdentityMutationLoginSchema,
  IdentityMutationLogoutSchema,
  type AnonymousIdentity,
  type RegisteredIdentity,
  type GuestIdentity,
  type Result,
  error,
  success,
} from '@reactionary/core';
import type { MagentoClient } from '../core/client.js';
import { isMagentoApiError } from '../core/errors.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import { handleMagentoProviderError } from '../utils/magento-errors.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:magento:identity');

/** Session key of the generated, per-session guest id. */
const GUEST_ID_SESSION_KEY = 'guestId';

/** Reads an optional, non-blank string field from a loose payload. */
function readOptionalString(
  payload: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Derives a readable name from an e-mail's local part
 * (`jane.doe@example.com` → `Jane` / `Doe`), as a fallback for Magento's
 * mandatory customer first and last name.
 */
export function deriveNameFromEmail(email: string): {
  firstname: string;
  lastname: string;
} {
  const localPart = email.split('@')[0] ?? '';
  const parts = localPart
    .split(/[._\-+]+/)
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  return {
    firstname: parts[0] || localPart || email,
    lastname: parts.slice(1).join(' ') || parts[0] || localPart || email,
  };
}

/**
 * Identity on Magento's customer token. The identity factory is not used:
 * identity is wired as a direct capability (config, cache, context, client),
 * and the identities produced here are the core shapes as they are.
 */
export class MagentoIdentityCapability extends IdentityCapability {
  protected config: MagentoConfiguration;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
  ) {
    super(cache, context);
    this.config = config;
  }

  protected createAnonymousIdentity(): AnonymousIdentity {
    return {
      type: 'Anonymous',
    };
  }

  /**
   * A guest is a shopper without a customer token who already has a cart.
   * Magento has no guest-customer entity, so the guest gets a random id that
   * is stable for the session (the masked cart id is a bearer secret for the
   * guest cart and is deliberately not exposed as an identity).
   */
  protected async createGuestIdentity(): Promise<GuestIdentity> {
    let guestId = await this.magentoApi.getSessionItem(GUEST_ID_SESSION_KEY);
    if (!guestId) {
      guestId = `guest-${globalThis.crypto.randomUUID()}`;
      await this.magentoApi.setSessionItem(GUEST_ID_SESSION_KEY, guestId);
    }
    return {
      type: 'Guest',
      id: {
        userId: guestId,
      },
    };
  }

  @Reactionary({
    inputSchema: IdentityQuerySelfSchema,
    outputSchema: IdentitySchema,
  })
  public override async getSelf(
    _payload: IdentityQuerySelf,
  ): Promise<Result<Identity>> {
    try {
      const customerToken = await this.magentoApi.getCustomerToken();

      if (customerToken) {
        // null: Magento rejected the token (401/403); other failures throw.
        const customerId = await this.magentoApi.getCustomerId();
        if (customerId !== null) {
          const identity = {
            id: {
              userId: String(customerId),
            },
            type: 'Registered',
          } satisfies RegisteredIdentity;

          this.updateIdentityContext(identity);
          return success(identity);
        }

        debug('getSelf: customer token rejected by Magento, clearing it');
        await this.magentoApi.logout();
      }

      const activeCartId = await this.magentoApi.getActiveCartId();
      if (activeCartId) {
        debug('Active cart found without customer token, treating as guest');
        const identity = await this.createGuestIdentity();
        this.updateIdentityContext(identity);
        return success(identity);
      }

      const identity = this.createAnonymousIdentity();
      this.updateIdentityContext(identity);
      return success(identity);
    } catch (err) {
      return handleMagentoProviderError('resolve the current identity', err);
    }
  }

  @Reactionary({
    inputSchema: IdentityMutationLoginSchema,
    outputSchema: IdentitySchema,
  })
  public override async login(
    payload: IdentityMutationLogin,
  ): Promise<Result<Identity>> {
    debug('Attempting login for user:', payload.username);
    try {
      await this.magentoApi.login(payload.username, payload.password);
    } catch (err) {
      // Magento answers bad credentials, locked and unconfirmed accounts
      // with 401 on the token endpoint.
      if (isMagentoApiError(err) && (err.status === 400 || err.status === 401)) {
        debug('login rejected: %O', err);
        return error<InvalidInputError>({
          type: 'InvalidInput',
          error:
            err.magentoMessage ||
            'The account sign-in was incorrect or the account is disabled.',
        });
      }
      return handleMagentoProviderError('log in', err);
    }

    return this.getSelf({});
  }

  @Reactionary({
    inputSchema: IdentityMutationLogoutSchema,
    outputSchema: IdentitySchema,
  })
  public override async logout(
    _payload: IdentityMutationLogout,
  ): Promise<Result<Identity>> {
    debug('Logging out user');
    try {
      await this.magentoApi.logout();
      // The customer's cart must not carry over into the anonymous session.
      await this.magentoApi.clearActiveCartId();
      await this.magentoApi.removeSessionItem(GUEST_ID_SESSION_KEY);
    } catch (err) {
      return handleMagentoProviderError('log out', err);
    }

    const identity = this.createAnonymousIdentity();
    this.updateIdentityContext(identity);
    return success(identity);
  }

  /**
   * Registers a customer. The core payload only carries `username` (the
   * e-mail) and `password`; because the schema is a loose object, callers
   * may also pass `firstName`/`lastName` (or Magento's
   * `firstname`/`lastname`). Magento requires both names, so when they are
   * missing they are derived from the e-mail's local part.
   */
  @Reactionary({
    inputSchema: IdentityMutationRegisterSchema,
    outputSchema: IdentitySchema,
  })
  public override async register(
    payload: IdentityMutationRegister,
  ): Promise<Result<Identity>> {
    debug('Registering new user:', payload.username);

    const derived = deriveNameFromEmail(payload.username);
    const customer = {
      email: payload.username,
      firstname:
        readOptionalString(payload, 'firstName', 'firstname') ?? derived.firstname,
      lastname:
        readOptionalString(payload, 'lastName', 'lastname') ?? derived.lastname,
    };

    try {
      await this.magentoApi.register(customer, payload.password);
    } catch (err) {
      // 400: duplicate e-mail, password policy or other rejected input.
      return handleMagentoProviderError('register customer', err);
    }

    return this.login({
      username: payload.username,
      password: payload.password,
    });
  }
}
