import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { MedusaCartProvider } from '../providers/cart.provider.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { MedusaCartIdentifierSchema } from '../schema/medusa.schema.js';
import { CartSchema, NoOpCache, createInitialRequestContext, type RequestContext } from '@reactionary/core';
import { getMedusaTestConfiguration } from './test-utils.js';



describe('Medusa Cart Provider', () => {
  let config: MedusaConfiguration;

  let provider: MedusaCartProvider;
  let reqCtx: RequestContext;

  beforeAll( () => {
    provider = new MedusaCartProvider(getMedusaTestConfiguration(), CartSchema, new NoOpCache());
  });

  beforeEach( () => {
    reqCtx = createInitialRequestContext()
  });

  describe('constructor', () => {
    it('should create a MedusaCartProvider instance', () => {
      expect(provider).toBeInstanceOf(MedusaCartProvider);
    });
  });

  describe('createEmptyCart', () => {
    it('should create an empty cart', () => {
      const emptyCart = provider['createEmptyCart']();

      expect(emptyCart.identifier.key).not.toBe('');
      expect(emptyCart.items).toEqual([]);
      expect(emptyCart.meta.placeholder).toBe(true);
    });
  });

  describe('MedusaCartIdentifierSchema', () => {
    it('should validate a valid cart identifier', () => {
      const validIdentifier = {
        key: 'cart_123',
        region_id: 'us',
      };

      const result = MedusaCartIdentifierSchema.parse(validIdentifier);
      expect(result).toEqual(validIdentifier);
    });

    it('should validate a cart identifier without region_id', () => {
      const validIdentifier = {
        key: 'cart_123',
      };

      const result = MedusaCartIdentifierSchema.parse(validIdentifier);
      expect(result.key).toBe('cart_123');
      expect(result.region_id).toBeUndefined();
    });

    it('should throw on invalid identifier', () => {
      const invalidIdentifier = {
        // missing key
        region_id: 'us',
      };

      expect(() => MedusaCartIdentifierSchema.parse(invalidIdentifier)).toThrow();
    });
  });

  describe('configuration', () => {
    it('should handle different regions', () => {
      const multiRegionConfig: MedusaConfiguration = {
        publishable_key: 'test-key',
        apiUrl: 'http://localhost:9000',
        defaultRegion: 'eu',
        allRegions: ['us', 'eu', 'asia'],
      };

      const testProvider = new MedusaCartProvider(multiRegionConfig, CartSchema, new NoOpCache());
      expect(testProvider['config'].defaultRegion).toBe('eu');
      expect(testProvider['config'].allRegions).toContain('asia');
    });
  });

  describe('error handling', () => {
    it('should handle quantity change to zero', async () => {
      const mockPayload = {
        cart: { key: 'cart_123' },
        item: { key: 'item_123' },
        quantity: 0,
      };

      // Mock getById to return empty cart
      vi.spyOn(provider, 'getById').mockResolvedValue(provider['createEmptyCart']());

      const result = await provider.changeQuantity(mockPayload, reqCtx);

      expect(result.meta.placeholder).toBe(true);
      expect(provider.getById).toHaveBeenCalled();
    });
  });
});
