import * as z from 'zod';

export const UnomiConfigurationSchema = z.looseObject({
  apiUrl: z.string().url(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  profilePath: z.string().default('/cxs/profiles'),
  scope: z.string().default('default'),
  conceptInterest: z.boolean().default(true).meta({ description: 'Send a concept_interest event per taxonomy concept next to the product and content events, so the CDP can build concept affinities. Nothing extra is sent when there are no concepts.' }),
  conceptInterestVocabularies: z.array(z.string()).optional().meta({ description: 'Only the concepts of these vocabularies are sent as interest. Defaults to all vocabularies.' }),
  maxConceptsPerEvent: z.int().min(0).default(5).meta({ description: 'The most concept_interest events sent for one product or content event, the most specific concepts first.' }),
  maxConceptsPerOrder: z.int().min(0).default(10).meta({ description: 'The most concept_interest events sent for one order, in total over all its lines.' }),
  encodeConceptIdSlash: z.boolean().default(false).meta({ description: 'Encode the slash of a concept id as __ in the itemId of concept_interest events, for a CDP that cannot take a slash in an id. Concept ids stay vocabulary/slug everywhere else.' }),
});

export type UnomiConfiguration = z.infer<typeof UnomiConfigurationSchema>;
/** What a caller passes: the keys with a default can be left out. */
export type UnomiConfigurationInput = z.input<typeof UnomiConfigurationSchema>;
