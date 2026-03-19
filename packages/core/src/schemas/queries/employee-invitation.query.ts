import type { InferType } from "../../zod-utils.js";
import { EmployeeInvitationSearchIdentifierSchema } from '../models/identifiers.model.js';
import { BaseQuerySchema } from "./base.query.js";

export const EmployeeInvitationQueryListSchema = BaseQuerySchema.extend({
    search:  EmployeeInvitationSearchIdentifierSchema
});

export type EmployeeInvitationQueryList = InferType<typeof EmployeeInvitationQueryListSchema>;
