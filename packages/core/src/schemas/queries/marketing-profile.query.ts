import type { InferType } from "../../zod-utils.js";
import { IdentitySchema } from "../models/identity.model.js";
import { ProfileSchema } from "../models/profile.model.js";
import { BaseQuerySchema } from "./base.query.js";

export const MarketingProfileQueryGetProfileSchema = BaseQuerySchema.extend({
    identity: IdentitySchema,
    profile: ProfileSchema.optional(),
});

export type MarketingProfileQueryGetProfile = InferType<typeof MarketingProfileQueryGetProfileSchema>;
