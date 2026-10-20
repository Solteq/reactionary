import { describe, expect, it } from "vitest";
import { createInitialRequestContext } from "../initialization.js";
import { LanguageContextSchema, RequestContextSchema } from "../schemas/session.schema.js";
import { CostBreakDownSchema } from "../schemas/models/cost.model.js";
import { MonetaryAmountSchema } from "../schemas/models/price.model.js";

describe('Request Context', () => {
  it('should be able to serialize the request context as a JSON string, and have it parse', async () => {
    const context = createInitialRequestContext();
    const contextString = JSON.stringify(context);
    const reconstructedContext = JSON.parse(contextString);
    
    const parse = RequestContextSchema.safeParse(reconstructedContext);

    expect(parse.success).toBe(true);
  });

  it('should keep monetary amounts strict but apply temporary EUR defaults for empty cost breakdowns and currency context', () => {
    expect(MonetaryAmountSchema.safeParse({}).success).toBe(false);
    expect(CostBreakDownSchema.parse({}).grandTotal).toMatchObject({
      value: 0,
      currency: 'EUR',
    });

    expect(LanguageContextSchema.parse({}).currencyCode).toBe('EUR');
  });
});
