import { z } from 'zod';

// TODO: Flesh out and wire up as part of the session issue
export const SessionSchema = z.looseObject({
    id: z.string(),
    user: z.string()
});

export type Session = z.infer<typeof SessionSchema>;