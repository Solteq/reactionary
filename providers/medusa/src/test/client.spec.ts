import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MedusaClient, RequestContextTokenStore } from '../core/client.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import {
  createInitialRequestContext,
  type RequestContext
} from '@reactionary/core';

// Mock the Medusa SDK
vi.mock('@medusajs/js-sdk', () => {
  const mockMedusa = {
    auth: {
      register: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      getSession: vi.fn(),
      resetPassword: vi.fn(),
    },
    store: {
      customer: {
        update: vi.fn(),
      },
    },
    client: {
      setClientHeaders: vi.fn(),
    },
  };

  return {
    default: vi.fn(() => mockMedusa),
  };
});

// Mock debug
vi.mock('debug', () => ({
  default: vi.fn(() => vi.fn()),
}));

describe('Medusa Client', () => {
  let client: MedusaClient;
  let config: MedusaConfiguration;

  beforeEach(() => {
    config = {
      publishable_key: 'test-key',
      apiUrl: 'http://localhost:9000',
      defaultRegion: 'us',
      allRegions: ['us', 'eu'],
    };

    client = new MedusaClient(config);
  });

  describe('constructor', () => {
    it('should create a MedusaClient instance', () => {
      expect(client).toBeInstanceOf(MedusaClient);
    });

    it('should store the configuration', () => {
      expect(client['config']).toEqual(config);
    });
  });

  describe('RequestContextTokenStore', () => {
    let tokenStore: RequestContextTokenStore;
    let reqCtx: RequestContext;

    beforeEach(() => {
      reqCtx = createInitialRequestContext();
      tokenStore = new RequestContextTokenStore(reqCtx);
    });

    it('should get token from context', async () => {
      reqCtx.identity.token = 'test-token';
      const token = await tokenStore.getToken();
      expect(token).toBe('test-token');
    });

    it('should set token in context', async () => {
      const testToken = 'new-token';
      const expiryDate = new Date();

      await tokenStore.setToken(testToken, expiryDate);

      expect(reqCtx.identity.token).toBe(testToken);
      expect(reqCtx.identity.expiry).toBe(expiryDate);
    });

    it('should clear token from context', async () => {
      reqCtx.identity.token = 'test-token';
      reqCtx.identity.refresh_token = 'refresh-token';

      await tokenStore.clearToken();

      expect(reqCtx.identity.token).toBeUndefined();
      expect(reqCtx.identity.refresh_token).toBeUndefined();
      expect(reqCtx.identity.expiry).toEqual(new Date(0));
    });
  });

  describe('configuration validation', () => {
    it('should accept valid configuration', () => {
      const validConfig: MedusaConfiguration = {
        publishable_key: 'pk_test_123',
        apiUrl: 'https://api.medusa.com',
        defaultRegion: 'us',
        allRegions: ['us', 'eu', 'asia'],
      };

      expect(() => new MedusaClient(validConfig)).not.toThrow();
    });

    it('should handle minimal configuration', () => {
      const minimalConfig: MedusaConfiguration = {
        publishable_key: 'pk_test_123',
        apiUrl: 'https://api.medusa.com',
        defaultRegion: 'us',
        allRegions: [],
      };

      expect(() => new MedusaClient(minimalConfig)).not.toThrow();
    });
  });
});
