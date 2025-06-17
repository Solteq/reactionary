import z from 'zod';
import { Price } from '../schemas/price.schema';

export abstract class PriceProvider<T = Price> {
  constructor(protected schema: z.ZodType<T>) {}

  protected validate(value: unknown): T {
    return this.schema.parse(value);
  }

  protected base(): T {
    return this.schema.parse({});
  }

  protected abstract get(): Promise<T>;
}
