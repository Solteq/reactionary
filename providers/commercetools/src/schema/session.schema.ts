import * as z from 'zod';

export const CommercetoolsSessionSchema = z.looseObject({
    token: z.string().default(''),
    refreshToken: z.string().optional(),
    expirationTime: z.number().default(0)
});