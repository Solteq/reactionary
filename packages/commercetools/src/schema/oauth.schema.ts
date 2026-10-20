import * as z from 'zod';

export const CommercetoolsTokenIntrospectionSchema = z.looseObject({
  active: z.boolean(),
  scope: z.string().optional(),
});

export const CommercetoolsAccessTokenSchema = z.looseObject({
  access_token: z.string(),
  expires_in: z.number(),
});
