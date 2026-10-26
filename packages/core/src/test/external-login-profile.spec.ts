import { describe, expect, it, vi } from 'vitest';
import { applyExternalLoginProfile } from '../utils/external-login-profile.js';
import { AddressSchema, ProfileSchema, type Address, type ExternalLoginResult, type Identity } from '../schemas/index.js';
import { createInitialRequestContext } from '../initialization.js';
import type { ProfileCapability } from '../capabilities/profile.capability.js';
import { IdentityCapability } from '../capabilities/identity.capability.js';
import { NoOpCache } from '../cache/noop-cache.js';
import { success, error } from '../schemas/result.js';

const address: Address = AddressSchema.parse({
  identifier: { nickName: 'billing' },
  firstName: 'Ada',
  lastName: 'Lovelace',
  streetAddress: 'Main Street 1',
  streetNumber: '',
  city: 'Copenhagen',
  region: '',
  postalCode: '1000',
  countryCode: 'DK',
});

const existingProfile = ProfileSchema.parse({
  identifier: { userId: 'u1' },
  email: 'stored@example.com',
  phone: '',
  emailVerified: true,
  phoneVerified: false,
  createdAt: '',
  updatedAt: '',
});

function login(externalLogin: ExternalLoginResult | undefined): Identity {
  return { type: 'Registered', id: { userId: 'u1' }, ...(externalLogin ? { externalLogin } : {}) };
}

function fakeClient() {
  const profile = {
    getById: vi.fn<ProfileCapability['getById']>(async () => success(existingProfile)),
    update: vi.fn<ProfileCapability['update']>(async () => success(existingProfile)),
    setBillingAddress: vi.fn<ProfileCapability['setBillingAddress']>(async () => success(existingProfile)),
  };
  return { profile, client: { profile } };
}

describe('applyExternalLoginProfile', () => {
  it('writes the phone number and the billing address of a new customer', async () => {
    const { client, profile } = fakeClient();
    await applyExternalLoginProfile(client, login({ isNewCustomer: true, profile: { email: 'ada@example.com', phone: '+4512345678', billingAddress: address } }));
    expect(profile.update).toHaveBeenCalledWith({ identifier: { userId: 'u1' }, email: 'ada@example.com', phone: '+4512345678' });
    expect(profile.setBillingAddress).toHaveBeenCalledWith({ identifier: { userId: 'u1' }, address });
    expect(profile.getById).not.toHaveBeenCalled();
  });

  it('does nothing for a returning customer, an anonymous identity or a login without profile data', async () => {
    const { client, profile } = fakeClient();
    await applyExternalLoginProfile(client, login({ isNewCustomer: false, profile: { phone: '+4512345678', billingAddress: address } }));
    await applyExternalLoginProfile(client, login(undefined));
    await applyExternalLoginProfile(client, { type: 'Anonymous' });
    await applyExternalLoginProfile(client, login({ isNewCustomer: true, profile: {} }));
    expect(profile.update).not.toHaveBeenCalled();
    expect(profile.setBillingAddress).not.toHaveBeenCalled();
  });

  it('reads the stored email when the claims have none, since the update needs one', async () => {
    const { client, profile } = fakeClient();
    await applyExternalLoginProfile(client, login({ isNewCustomer: true, profile: { phone: '+4512345678' } }));
    expect(profile.update).toHaveBeenCalledWith({ identifier: { userId: 'u1' }, email: 'stored@example.com', phone: '+4512345678' });
  });

  it('keeps going and reports when a write fails or throws', async () => {
    const { client, profile } = fakeClient();
    profile.update.mockRejectedValueOnce(new Error('boom'));
    profile.setBillingAddress.mockResolvedValueOnce(error({ type: 'NotFound', identifier: { userId: 'u1' } }));
    const onError = vi.fn();
    await applyExternalLoginProfile(client, login({ isNewCustomer: true, profile: { email: 'a@b.dk', phone: '1', billingAddress: address } }), onError);
    expect(onError).toHaveBeenCalledTimes(2);
  });
});

class TestIdentity extends IdentityCapability {
  store(identity: Identity) {
    this.updateIdentityContext(identity);
  }
  override async getSelf() { return success(this.context.session.identityContext.identity); }
  override async login() { return success(this.context.session.identityContext.identity); }
  override async logout() { return success(this.context.session.identityContext.identity); }
  override async register() { return success(this.context.session.identityContext.identity); }
  override async listProviders() { return success([]); }
  override async startExternalLogin() { return error({ type: 'InvalidInput' as const, error: 'unused' }); }
  override async completeExternalLogin() { return error({ type: 'InvalidInput' as const, error: 'unused' }); }
}

describe('updateIdentityContext', () => {
  it('does not keep what an external login learned in the session', () => {
    const context = createInitialRequestContext();
    new TestIdentity(new NoOpCache(), context).store(login({ isNewCustomer: true, profile: { phone: '+4512345678' } }));
    expect(context.session.identityContext.identity).toEqual({ type: 'Registered', id: { userId: 'u1' } });
  });
});
