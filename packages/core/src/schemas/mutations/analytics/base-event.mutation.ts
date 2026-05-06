import type { InferType } from "../../../zod-utils.js";
import { PersonalizationProfileSchema } from "../../models/personalization-profile.model.js";
import { BaseMutationSchema } from "../base.mutation.js";

export const AnalyticsBaseMutationSchema =
  BaseMutationSchema.extend({
    personalizationProfile: PersonalizationProfileSchema.optional().meta({ description: 'The personalization profile of the user associated with the event. This can be used to provide personalized experiences based on the user\'s segments and other attributes defined in their personalization profile, if any' }),
  });


export type AnalyticsBaseMutation = InferType<typeof AnalyticsBaseMutationSchema>;
