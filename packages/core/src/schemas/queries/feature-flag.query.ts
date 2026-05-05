import * as z from 'zod';
import type { InferType } from "../../zod-utils.js";
import { FeatureFlagIdentifierSchema } from "../models/identifiers.model.js";
import { MarketingProfileSchema } from '../models/marketing-profile.model.js';
import { BaseQuerySchema } from "./base.query.js";


export const FeatureFlagQueryGetFlagsSchema = BaseQuerySchema.extend({
  featureFlagIdentifiers: z.array(FeatureFlagIdentifierSchema).meta({ description: 'The identifiers of the feature flags to retrieve.' }),
  marketingProfile: MarketingProfileSchema.optional().meta({ description: 'The marketing profile to use for evaluating the feature flags.' }),
});

export type FeatureFlagQueryGetFlags = InferType<typeof FeatureFlagQueryGetFlagsSchema>;
