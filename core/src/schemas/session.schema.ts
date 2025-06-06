import { z } from 'zod';
import { IdentitySchema } from './identity.schema';

export const SessionSchema = z.looseObject({
    id: z.string(),
    identity: IdentitySchema.default(() => IdentitySchema.parse({}))
});

export type Session = z.infer<typeof SessionSchema>;