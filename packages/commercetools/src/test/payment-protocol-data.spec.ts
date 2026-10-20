import { describe, expect, it } from 'vitest';
import { parseProtocolDataField, serializeProtocolData } from '../core/payment-protocol-data.js';

describe('payment protocol data field', () => {
  it('round-trips protocol data entries', () => {
    const entries = [
      { key: 'delegated_payment_token', value: 'spt_123' },
      { key: 'delegated_payment_provider', value: 'stripe' },
    ];

    expect(parseProtocolDataField(serializeProtocolData(entries))).toEqual(entries);
  });

  it('flattens what a payment extension wrote back', () => {
    expect(parseProtocolDataField(JSON.stringify({
      stripe_clientSecret: 'pi_1_secret',
      stripe_status: 'requires_capture',
    }))).toEqual([
      { key: 'stripe_clientSecret', value: 'pi_1_secret' },
      { key: 'stripe_status', value: 'requires_capture' },
    ]);
  });

  it('stringifies non-string values so entries stay schema-valid', () => {
    expect(parseProtocolDataField(JSON.stringify({
      stripe_amountCapturable: 4200,
      stripe_metadata: { orderId: 'o-1' },
    }))).toEqual([
      { key: 'stripe_amountCapturable', value: '4200' },
      { key: 'stripe_metadata', value: '{"orderId":"o-1"}' },
    ]);
  });

  it('ignores empty and malformed content', () => {
    expect(parseProtocolDataField(undefined)).toEqual([]);
    expect(parseProtocolDataField('')).toEqual([]);
    expect(parseProtocolDataField('{not json')).toEqual([]);
    expect(parseProtocolDataField('["a"]')).toEqual([]);
  });
});
