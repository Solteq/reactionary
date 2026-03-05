import type * as z from 'zod';
import type { OrderSchema } from '../schemas/models/order.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyOrderSchema = z.ZodType<z.output<typeof OrderSchema>>;

export interface OrderFactory<TOrderSchema extends AnyOrderSchema = AnyOrderSchema> {
  orderSchema: TOrderSchema;
  parseOrder(context: RequestContext, data: unknown): z.output<TOrderSchema>;
}

export type OrderFactoryOutput<TFactory extends OrderFactory> = ReturnType<
  TFactory['parseOrder']
>;

export type OrderFactoryWithOutput<TFactory extends OrderFactory> = Omit<
  TFactory,
  'parseOrder'
> & {
  parseOrder(context: RequestContext, data: unknown): OrderFactoryOutput<TFactory>;
};
