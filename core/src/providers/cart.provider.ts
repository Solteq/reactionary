import z from "zod";
import { Session } from "../schemas/session.schema";
import { Cart, CartItemAddPayload, CartItemAdjustPayload, CartItemRemovePayload, CartGetPayload } from "../schemas/cart.schema";

export abstract class CartProvider<T = Cart> {
      constructor(protected schema: z.ZodType<T>) {}
    
      protected validate(value: unknown): T {
        return this.schema.parse(value);
      }
    
      protected base(): T {
        return this.schema.parse({});
      }
    
      public abstract get(payload: CartGetPayload, session: Session): Promise<T>;
      public abstract add(payload: CartItemAddPayload, session: Session): Promise<T>;
      public abstract adjust(payload: CartItemAdjustPayload, session: Session): Promise<T>;
      public abstract remove(payload: CartItemRemovePayload, session: Session): Promise<T>;
}