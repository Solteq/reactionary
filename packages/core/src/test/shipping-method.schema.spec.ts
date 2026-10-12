import { describe, expect, it } from 'vitest';
import {
  ShippingInstructionSchema,
  ShippingMethodSchema,
  ShippingProtocolDataSchema,
} from '../schemas/models/shipping-method.model.js';

describe('ShippingProtocolDataSchema', () => {
  it('accepts a plain string value', () => {
    const parsed = ShippingProtocolDataSchema.parse({
      key: 'timeSlotId',
      value: 'slot-42',
    });

    expect(parsed).toMatchObject({ key: 'timeSlotId', value: 'slot-42' });
  });

  it('accepts a JSON object value and round-trips it through serialization', () => {
    const value = {
      from: '2026-10-14T10:00:00Z',
      to: '2026-10-14T12:00:00Z',
      capacity: 3,
      nested: { carrier: 'own-fleet' },
    };

    const parsed = ShippingProtocolDataSchema.parse({ key: 'timeSlot', value });

    expect(parsed.value).toEqual(value);
    expect(JSON.parse(JSON.stringify(parsed.value))).toEqual(value);
  });

  it('rejects a value that is neither a string nor an object', () => {
    expect(() => ShippingProtocolDataSchema.parse({ key: 'k', value: 42 })).toThrow();
  });

  it('rejects an entry without a key', () => {
    expect(() => ShippingProtocolDataSchema.parse({ value: 'v' })).toThrow();
  });
});

describe('ShippingMethodSchema BOPIS additions', () => {
  const baseMethod = {
    identifier: { key: 'standard' },
    name: 'Standard',
    description: 'Standard delivery',
    price: { value: 5, currency: 'EUR' },
    deliveryTime: '1-2 days',
  };

  it('still parses a shipping method without the new optional fields', () => {
    const parsed = ShippingMethodSchema.parse(baseMethod);

    expect(parsed.fulfillmentType).toBeUndefined();
    expect(parsed.protocolData).toBeUndefined();
  });

  it('parses fulfillmentType and protocolData when present', () => {
    const parsed = ShippingMethodSchema.parse({
      ...baseMethod,
      fulfillmentType: 'pickup',
      protocolData: [
        { key: 'slot', value: 'morning' },
        { key: 'window', value: { from: '10:00', to: '12:00' } },
      ],
    });

    expect(parsed.fulfillmentType).toBe('pickup');
    expect(parsed.protocolData).toHaveLength(2);
  });

  it('rejects an unknown fulfillmentType', () => {
    expect(() =>
      ShippingMethodSchema.parse({ ...baseMethod, fulfillmentType: 'teleport' }),
    ).toThrow();
  });
});

describe('ShippingInstructionSchema BOPIS additions', () => {
  const baseInstruction = {
    shippingMethod: { key: 'standard' },
    pickupPoint: '',
    instructions: '',
    consentForUnattendedDelivery: false,
  };

  it('still parses an instruction without the new optional fields', () => {
    const parsed = ShippingInstructionSchema.parse(baseInstruction);

    expect(parsed.store).toBeUndefined();
    expect(parsed.protocolData).toBeUndefined();
  });

  it('parses an own-brand store reference alongside the reserved pickupPoint field', () => {
    const parsed = ShippingInstructionSchema.parse({
      ...baseInstruction,
      store: { key: 'copenhagen-flagship' },
      protocolData: [{ key: 'pickupSlot', value: { day: 'monday' } }],
    });

    expect(parsed.store).toEqual({ key: 'copenhagen-flagship' });
    expect(parsed.pickupPoint).toBe('');
    expect(parsed.protocolData).toEqual([{ key: 'pickupSlot', value: { day: 'monday' } }]);
  });
});
