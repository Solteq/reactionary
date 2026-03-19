import * as z from 'zod';
import type { InferType } from "../../zod-utils.js";
import { BaseQuerySchema } from "./base.query.js";
import { EmployeeInvitationSearchIdentifierSchema } from '../models/identifiers.model.js';

export const EmployeeInvitationQueryListSchema = BaseQuerySchema.extend({
    search:  EmployeeInvitationSearchIdentifierSchema
});

export type EmployeeInvitationQueryList = InferType<typeof EmployeeInvitationQueryListSchema>;
