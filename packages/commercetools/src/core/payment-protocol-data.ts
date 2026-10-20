/**
 * A payment's protocol channel: one JSON custom field on the
 * `reactionaryPaymentCustomFields` type, exchanged in both directions with the
 * project's payment API extensions. reactionary writes a payment instruction's
 * protocol data into it; extensions consume what they understand (e.g. agent
 * payment tokens) and write their results back (e.g. a Stripe client secret).
 * One declared field carries arbitrary keys, which separate custom fields could
 * not: commercetools rejects undeclared fields.
 */
export const PROTOCOL_DATA_FIELD = 'reactionaryProtocolData';

export function serializeProtocolData(
  entries: Array<{ key: string; value: string }>,
): string {
  return JSON.stringify(Object.fromEntries(entries.map((entry) => [entry.key, entry.value])));
}

export function parseProtocolDataField(
  value: unknown,
): Array<{ key: string; value: string }> {
  if (typeof value !== 'string' || value.length === 0) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return [];
    }

    return Object.entries(parsed).map(([key, entry]) => ({
      key,
      value: typeof entry === 'string' ? entry : JSON.stringify(entry),
    }));
  } catch {
    return [];
  }
}
