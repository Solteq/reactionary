import z from 'zod';
import { Inventory } from '../schemas/inventory.schema';
import { Session } from '../schemas/session.schema';
import { InventoryQuery } from '../schemas/queries/inventory.query';

export abstract class InventoryProvider<T = Inventory> {
  constructor(protected schema: z.ZodType<T>) {}

  protected validate(value: unknown): T {
    return this.schema.parse(value);
  }

  protected base(): T {
    return this.schema.parse({});
  }

  public abstract query(query: InventoryQuery, session: Session): Promise<T>;
}
