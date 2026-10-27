import * as z from 'zod';
import { PersonalizationProfileIdentifierSchema } from "./identifiers.model.js";
import type { InferType } from '../../zod-utils.js';

export const PersonalizationProfileSchema = z.looseObject({
    identifier: PersonalizationProfileIdentifierSchema.meta({ description: 'The identifier object for the marketing profile. This should contain a unique key that identifies the marketing profile.' }),
    segments: z.array(z.string()).default(() => []).meta({ description: 'The segments that the marketing profile belongs to. This can be used for targeting specific segments with feature flags or other marketing activities.' }  ),
    affinities: z.record(z.string(), z.number()).default(() => ({})).meta({ description: 'The interest of the visitor in taxonomy concepts, concept id to a weight in (0, 1]. Derived from the affinity.<vocabulary>.<slug>.<low|medium|high> segments, so banded and never a raw score. Personal data, use it server side only, consent is the responsibility of the producer.' }),
    blurb: z.string().default('').meta({ description: 'A short description or blurb about the marketing profile. This can be used for informational purposes or to provide context about the marketing profile.' }),
});



export type PersonalizationProfile = InferType<typeof PersonalizationProfileSchema>;
