import { z } from 'zod';

export const ImageSchema = z.looseInterface({
    uri: z.url().nonoptional().default("https://placehold.co/400"),
    width: z.number().nonoptional().default(400),
    height: z.number().nonoptional().default(400),
    title: z.string().default('')
});

export type Image = z.infer<typeof ImageSchema>;