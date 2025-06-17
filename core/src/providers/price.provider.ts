import z from 'zod';
import { Price } from '../schemas/price.schema';
import { PriceQuery } from '../schemas/queries/price.query';
import { Session } from '../schemas/session.schema';

export abstract class PriceProvider<T = Price> {
  constructor(protected schema: z.ZodType<T>) {}

  protected validate(value: unknown): T {
    return this.schema.parse(value);
  }

  protected base(): T {
    return this.schema.parse({});
  }

  public abstract query(query: PriceQuery, session: Session): Promise<T>;
}
