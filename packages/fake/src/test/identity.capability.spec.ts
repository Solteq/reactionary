import type { RequestContext } from '@reactionary/core';
import { NoOpCache, createInitialRequestContext, IdentitySchema } from '@reactionary/core';
import { describe, expect, it, beforeEach, assert } from 'vitest';
import { getFakerTestConfiguration } from './test-utils.js';
import { FakeIdentityCapability } from '../capabilities/index.js';
import { FakeIdentityFactory } from '../factories/index.js';

describe('Fake Identity Provider: external login', () => {
  let provider: FakeIdentityCapability;
  let reqCtx: RequestContext;
  const callbackUrl = 'https://shop.example/auth/callback/fake-oidc';
  const providerKey = { key: 'fake-oidc' };

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    provider = new FakeIdentityCapability(
      getFakerTestConfiguration(),
      new NoOpCache(),
      reqCtx,
      new FakeIdentityFactory(IdentitySchema),
    );
  });

  async function start() {
    const started = await provider.startExternalLogin({ provider: providerKey, callbackUrl });
    assert(started.success);
    return Object.fromEntries(new URL(started.value.location).searchParams);
  }

  it('puts the requested prompt on the redirect', async () => {
    const started = await provider.startExternalLogin({ provider: providerKey, callbackUrl, prompt: 'login' });
    assert(started.success);
    expect(new URL(started.value.location).searchParams.get('prompt')).toBe('login');
  });

  it('lists password and redirect providers', async () => {
    const providers = await provider.listProviders({});
    assert(providers.success);
    expect(providers.value.map((p) => [p.identifier.key, p.flow])).toEqual([
      ['password', 'credentials'],
      ['fake-oidc', 'redirect'],
    ]);
  });

  it('completes a started login and records the identity in the session', async () => {
    const callbackParameters = await start();
    const completed = await provider.completeExternalLogin({ provider: providerKey, callbackUrl, callbackParameters });
    assert(completed.success);
    expect(completed.value.type).toBe('Registered');
    expect(reqCtx.session.identityContext.identity.type).toBe('Registered');
    expect(reqCtx.session.identityContext.pendingExternalLogin).toBeUndefined();
  });

  it('rejects a callback whose state was not issued to this session', async () => {
    await start();
    const completed = await provider.completeExternalLogin({
      provider: providerKey,
      callbackUrl,
      callbackParameters: { code: 'fake-code', state: 'forged' },
    });
    assert(!completed.success);
    expect(completed.error.type).toBe('InvalidInput');
  });

  it('rejects a callback that is replayed after completion', async () => {
    const callbackParameters = await start();
    await provider.completeExternalLogin({ provider: providerKey, callbackUrl, callbackParameters });
    const replay = await provider.completeExternalLogin({ provider: providerKey, callbackUrl, callbackParameters });
    assert(!replay.success);
  });

  it('rejects a callback after the pending login has expired', async () => {
    const callbackParameters = await start();
    const pending = reqCtx.session.identityContext.pendingExternalLogin;
    assert(pending);
    pending.createdAt = new Date(Date.now() - 11 * 60 * 1000);
    const completed = await provider.completeExternalLogin({ provider: providerKey, callbackUrl, callbackParameters });
    assert(!completed.success);
    expect(completed.error.type).toBe('InvalidInput');
  });

  it('reports an existing account as an IdentityConflict', async () => {
    const { state } = await start();
    const completed = await provider.completeExternalLogin({
      provider: providerKey,
      callbackUrl,
      callbackParameters: { code: 'conflict', state: state as string },
    });
    assert(!completed.success);
    expect(completed.error.type).toBe('IdentityConflict');
  });
});
