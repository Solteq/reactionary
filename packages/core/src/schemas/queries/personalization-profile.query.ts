import type { InferType } from "../../zod-utils.js";
import { PersonalizationProfileIdentifierSchema } from "../models/identifiers.model.js";
import { IdentitySchema } from "../models/identity.model.js";
import { PersonalizationProfileSchema } from "../models/personalization-profile.model.js";
import { ProfileSchema } from "../models/profile.model.js";
import { BaseQuerySchema } from "./base.query.js";

export const PersonalizationProfileQueryGetProfileSchema = BaseQuerySchema.extend({
    identity: IdentitySchema,
    profile: ProfileSchema.optional(),
    personalizationProfileIdentifier: PersonalizationProfileIdentifierSchema.optional().meta({ description: 'The identifier of the personalization profile to retrieve. If not provided, the system will attempt to resolve the personalization profile based on the provided identity.' }),
});

export type PersonalizationProfileQueryGetProfile = InferType<typeof PersonalizationProfileQueryGetProfileSchema>;
