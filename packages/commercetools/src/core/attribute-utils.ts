import type { Attribute as CTAttribute } from '@commercetools/platform-sdk';
import type { ProductOptionIdentifier, ProductVariantOption } from '@reactionary/core';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Resolves an attribute value to a key and a display label, covering plain values,
 * localized text and (localized) enums. Sets and other complex values use their first entry.
 */
export function getAttributeValueKeyAndLabel(value: unknown, language: string): { key: string; label: string } {
  if (Array.isArray(value)) {
    return getAttributeValueKeyAndLabel(value[0], language);
  }

  if (isRecord(value)) {
    if ('key' in value && 'label' in value) {
      const key = String(value['key']);
      const label = getAttributeValueKeyAndLabel(value['label'], language).label;
      return { key, label: label || key };
    }

    // Localized text, falling back to any available translation
    const localized = value[language] ?? Object.values(value).find((text) => typeof text === 'string');
    const text = typeof localized === 'string' ? localized : '';
    return { key: text, label: text };
  }

  const text = value === undefined || value === null ? '' : String(value);
  return { key: text, label: text };
}

/**
 * Maps a variant attribute to a variant option, using the attribute name as the option.
 */
export function parseVariantOptionFromAttribute(attribute: CTAttribute, language: string): ProductVariantOption {
  const option = { key: attribute.name } satisfies ProductOptionIdentifier;
  const { key, label } = getAttributeValueKeyAndLabel(attribute.value, language);

  return {
    identifier: option,
    name: attribute.name,
    value: {
      identifier: { option, key },
      label,
    },
  } satisfies ProductVariantOption;
}
