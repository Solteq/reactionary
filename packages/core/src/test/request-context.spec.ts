import { describe, expect, it } from "vitest";
import { createInitialRequestContext } from "../initialization.js";
import { RequestContextSchema } from "../schemas/session.schema.js";

describe('Request Context', () => {
  it('should be able to serialize the request context as a JSON string, and have it parse', async () => {
    const context = createInitialRequestContext();
    const contextString = JSON.stringify(context);
    const reconstructedContext = JSON.parse(contextString);
    
    const parse = RequestContextSchema.safeParse(reconstructedContext);

    expect(parse.success).toBe(true);
  });
});