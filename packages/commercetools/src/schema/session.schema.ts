import * as z from 'zod';

export const CommercetoolsSessionSchema = z.looseObject({
    token: z.string().default(''),
    refreshToken: z.string().optional(),
    expirationTime: z.number().default(0),
    tokenSource: z.enum(['commercetools', 'external']).optional().meta({ description: 'external when token is an identity provider access token from an external login.' }),
    externalProvider: z.string().optional().meta({ description: 'Key of the external identity provider that issued token.' }),
    customerId: z.string().optional().meta({ description: 'The commercetools customer of an external login.' }),
});

export type CommercetoolsSession = z.infer<typeof CommercetoolsSessionSchema>;
