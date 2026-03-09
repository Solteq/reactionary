import type {
  AnyOrderSchema,
  OrderFactory,
  OrderSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class FakeOrderFactory<
  TOrderSchema extends AnyOrderSchema = typeof OrderSchema,
> implements OrderFactory<TOrderSchema>
{
  public readonly orderSchema: TOrderSchema;

  constructor(orderSchema: TOrderSchema) {
    this.orderSchema = orderSchema;
  }

  public parseOrder(_context: RequestContext, data: unknown): z.output<TOrderSchema> {
    return this.orderSchema.parse(data);
  }
}
