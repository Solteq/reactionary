import { z } from 'zod';
import { IdentitySchema } from './models/identity.model';

export const SessionSchema = z.looseObject({
    id: z.string(),
    identity: IdentitySchema.default(() => IdentitySchema.parse({}))
});

export type Session = z.infer<typeof SessionSchema>;