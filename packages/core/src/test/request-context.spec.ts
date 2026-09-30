import { describe, expect, it } from "vitest";
import { createInitialRequestContext } from "../initialization.js";
import { LanguageContextSchema, RequestContextSchema } from "../schemas/session.schema.js";
import { MonetaryAmountSchema } from "../schemas/models/price.model.js";

describe('Request Context', () => {
  it('should be able to serialize the request context as a JSON string, and have it parse', async () => {
    const context = createInitialRequestContext();
    const contextString = JSON.stringify(context);
    const reconstructedContext = JSON.parse(contextString);
    
    const parse = RequestContextSchema.safeParse(reconstructedContext);

    expect(parse.success).toBe(true);
  });

  it('should apply temporary EUR defaults for empty monetary values and currency context', () => {
    expect(MonetaryAmountSchema.parse({})).toMatchObject({
      value: 0,
      currency: 'EUR',
    });

    expect(LanguageContextSchema.parse({}).currencyCode).toBe('EUR');
  });
});
