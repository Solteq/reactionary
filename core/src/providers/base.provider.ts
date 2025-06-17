import { z } from 'zod';
import { Session } from '../schemas/session.schema';
import { BaseQuery } from '../schemas/queries/base.query';
import { BaseMutation } from '../schemas/mutations/base.mutation';

export abstract class BaseProvider<T> {
  constructor(protected schema: z.ZodType<T>) {}

  protected validate(value: unknown): T {
    return this.schema.parse(value);
  }

  protected base(): T {
    return this.schema.parse({});
  }

  public abstract parse(data: unknown, query: BaseQuery): T;
  public abstract query(query: BaseQuery, session: Session): Promise<T>;
  public abstract mutate(mutation: BaseMutation, session: Session): Promise<T>;
}
