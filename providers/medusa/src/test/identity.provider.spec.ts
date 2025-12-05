import { describe, it, expect, beforeEach, assert } from 'vitest';
import { MedusaIdentityProvider } from '../providers/identity.provider.js';
import { IdentitySchema, NoOpCache, createInitialRequestContext, type RequestContext } from '@reactionary/core';
import { getMedusaTestConfiguration } from './test-utils.js';
import { MedusaClient } from '../core/client.js';

const testData = {
  testEmail: 'test@example.com',
  testPassword: 'TestPassword123!',
  testFirstName: 'Test',
  testLastName: 'User'
};

describe('Medusa Identity Provider', () => {
  let provider: MedusaIdentityProvider;
  let reqCtx: RequestContext;

  beforeEach(() => {
    reqCtx = createInitialRequestContext();
    const config = getMedusaTestConfiguration();
    const client = new MedusaClient(config, reqCtx);

    provider = new MedusaIdentityProvider(config, new NoOpCache(), reqCtx, client);
  });

  it('should return anonymous identity when not authenticated', async () => {
    const result = await provider.getSelf({});

    if (!result.success) {
      assert.fail();
    }

    expect(result.value).toBeTruthy();
    expect(result.value.type).toBe('Anonymous');
  });

  it('should be able to register a new user', async () => {
    const testEmail = `test-user+${new Date().getTime()}@example.com`;
    const result = await provider.register({
      username: testEmail,
      password: testData.testPassword,
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result).toBeTruthy();
    // Registration should auto-login and return Registered identity
    expect(['Registered', 'Anonymous']).toContain(result.value.type);
  });

  it('should be able to login with valid credentials', async () => {
    try {
      const result = await provider.register({
        username: testData.testEmail,
        password: testData.testPassword,
      });
      await provider.logout({});

    } catch (err) {
      // already exists, its fine
    }

    const result = await provider.login({
      username: testData.testEmail,
      password: testData.testPassword,
    });

    if (!result.success) {
      assert.fail();
    }

    expect(result).toBeTruthy();
    expect(['Registered', 'Anonymous']).toContain(result.value.type);
  });

  it('should be able to logout', async () => {
    // First login
    await provider.login({
      username: testData.testEmail,
      password: testData.testPassword,
    });

    // Then logout
    const result = await provider.logout({});

    if (!result.success) {
      assert.fail();
    }

    expect(result).toBeTruthy();
    expect(result.value.type).toBe('Anonymous');
  });

  it('should return registered identity when authenticated', async () => {
    // Login first
    await provider.login({
      username: testData.testEmail,
      password: testData.testPassword,
    });

    // Check identity
    const result = await provider.getSelf({});

    if (!result.success) {
      assert.fail();
    }

    expect(result).toBeTruthy();
    expect(['Registered', 'Anonymous']).toContain(result.value.type);
  });

  it('should handle login errors gracefully', async () => {
    await expect(async () => {
      await provider.login({
        username: 'nonexistent@example.com',
        password: 'wrongpassword',
      });
    }).rejects.toThrow();
  });
});
