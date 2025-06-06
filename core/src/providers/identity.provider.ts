import z from "zod";
import { Identity, IdentityLoginPayload } from "../schemas/identity.schema";
import { Session } from "../schemas/session.schema";

export abstract class IdentityProvider<T = Identity> {
      constructor(protected schema: z.ZodType<T>) {}
    
      protected validate(value: unknown): T {
        return this.schema.parse(value);
      }
    
      protected base(): T {
        return this.schema.parse({});
      }
    
      public abstract get(session: Session): Promise<T>;
      public abstract login(payload: IdentityLoginPayload, session: Session): Promise<T>;
      public abstract logout(session: Session): Promise<T>;
}