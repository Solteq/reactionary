import * as z from 'zod';
import { CartIdentifierSchema, FeatureFlagIdentifierSchema, MarketingProfileIdentifierSchema } from "./identifiers.model.js";
import type { InferType } from '../../zod-utils.js';

export const MarketingProfileSchema = z.looseObject({
    identifier: z.looseObject({
        key: z.string().meta({ description: 'The unique identifier for the marketing profile.' }),
    }).meta({ description: 'The identifier object for the marketing profile. This should contain a unique key that identifies the marketing profile.' }),
    segments: z.array(z.string()).default(() => []).meta({ description: 'The segments that the marketing profile belongs to. This can be used for targeting specific segments with feature flags or other marketing activities.' }  ),
    blurb: z.string().default('').meta({ description: 'A short description or blurb about the marketing profile. This can be used for informational purposes or to provide context about the marketing profile.' }),
});



export type MarketingProfile = InferType<typeof MarketingProfileSchema>;
