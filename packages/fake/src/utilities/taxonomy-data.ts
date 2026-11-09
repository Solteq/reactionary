/**
 * The small taxonomy of the fake provider: two vocabularies of four concepts each. The ids are the ones the
 * producer uses in its fixtures, the names are available in English and Danish.
 */
export interface FakeConceptRecord {
  vocabulary: string;
  slug: string;
  names: Record<string, string>;
  synonyms?: Record<string, string[]>;
  notation?: string;
  definition?: Record<string, string>;
  related?: string[];
}

export const FAKE_VOCABULARY_NAMES: Record<string, Record<string, string>> = {
  features: { en: 'Features', da: 'Egenskaber' },
  campaigns: { en: 'Campaigns', da: 'Kampagner' },
};

export const FAKE_CONCEPTS: FakeConceptRecord[] = [
  {
    vocabulary: 'features',
    slug: 'cordless',
    names: { en: 'Cordless', da: 'Traadloes' },
    synonyms: { en: ['battery powered'], da: ['batteridrevet'] },
    notation: 'F-001',
    definition: { en: 'Runs on a battery, without a cable.', da: 'Koerer paa batteri, uden ledning.' },
    related: ['features/outdoor-rated'],
  },
  {
    vocabulary: 'features',
    slug: 'outdoor-rated',
    names: { en: 'Outdoor rated', da: 'Til udendoers brug' },
    notation: 'F-002',
    related: ['features/cordless'],
  },
  {
    vocabulary: 'features',
    slug: 'energy-efficient',
    names: { en: 'Energy efficient', da: 'Energieffektiv' },
    synonyms: { en: ['low consumption'] },
  },
  { vocabulary: 'features', slug: 'compact', names: { en: 'Compact', da: 'Kompakt' } },
  { vocabulary: 'campaigns', slug: 'new', names: { en: 'New', da: 'Nyhed' }, notation: 'C-001' },
  { vocabulary: 'campaigns', slug: 'sale', names: { en: 'Sale', da: 'Udsalg' }, synonyms: { en: ['discount'], da: ['tilbud'] } },
  { vocabulary: 'campaigns', slug: 'summer', names: { en: 'Summer', da: 'Sommer' } },
  { vocabulary: 'campaigns', slug: 'black-friday', names: { en: 'Black Friday', da: 'Black Friday' } },
];
