import type { InferType } from "../../zod-utils.js";
import { IdentitySchema } from "../models/identity.model.js";
import { ProfileSchema } from "../models/profile.model.js";
import { BaseQuerySchema } from "./base.query.js";

export const PersonalizationProfileQueryGetProfileSchema = BaseQuerySchema.extend({
    identity: IdentitySchema,
    profile: ProfileSchema.optional(),
});

export type PersonalizationProfileQueryGetProfile = InferType<typeof PersonalizationProfileQueryGetProfileSchema>;
