import type { InferType } from "../../zod-utils.js";
import { BaseModelSchema } from "./base.model.js";
import * as z from "zod";
import { FeatureFlagIdentifierSchema } from "./identifiers.model.js";

export const BaseFeatureFlagSchema = BaseModelSchema.extend({
    identifier: FeatureFlagIdentifierSchema,
});

export const BooleanFeatureFlagSchema = BaseFeatureFlagSchema.extend({
    type: z.literal('boolean').meta({ description: 'The type of feature flag, which is boolean in this case.' }),
    enabled: z.boolean().meta({ description: 'Indicates whether the feature flag is enabled or not.' }),
});

export const MultivariateFeatureFlagSchema = BaseFeatureFlagSchema.extend({
    type: z.literal('multivariate').meta({ description: 'The type of feature flag, which is multivariate in this case.' }),
    variants: z.array(z.object({
        name: z.string().meta({ description: 'The name of the variant.' }),
        enabled: z.boolean().meta({ description: 'Indicates whether the variant is enabled or not.' }),
    })).meta({ description: 'The variants for the multivariate feature flag.' }),
});

export const FeatureFlagSchema = z.discriminatedUnion('type', [
    BooleanFeatureFlagSchema,
    MultivariateFeatureFlagSchema
]);

export type BooleanFeatureFlag = InferType<typeof BooleanFeatureFlagSchema>;
export type MultivariateFeatureFlag = InferType<typeof MultivariateFeatureFlagSchema>;
export type FeatureFlag = InferType<typeof FeatureFlagSchema>;
