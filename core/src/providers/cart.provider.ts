import { BaseProvider } from "./base.provider";
import { Cart } from "../schemas/models/cart.model";
import { CartQueryById } from "../schemas/queries/cart.query";
import { Session } from "../schemas/session.schema";
import { CartMutationItemAdd, CartMutationItemQuantityChange, CartMutationItemRemove } from "../schemas/mutations/cart.mutation";
import { trpcQuery, trpcMutation } from '../decorators/trpc.decorators';

export abstract class CartProvider<
  T extends Cart = Cart
> extends BaseProvider<T> {
  public abstract getById(payload: CartQueryById, session: Session): Promise<T>;
  public abstract add(payload: CartMutationItemAdd, session: Session): Promise<T>;
  public abstract remove(payload: CartMutationItemRemove, session: Session): Promise<T>;
  public abstract changeQuantity(payload: CartMutationItemQuantityChange, session: Session): Promise<T>;
}