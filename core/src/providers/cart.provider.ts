import { CartQuery } from "../schemas/queries/cart.query";
import { CartMutation } from "../schemas/mutations/cart.mutation";
import { BaseProvider } from "./base.provider";
import { Cart } from "../schemas/models/cart.model";

export abstract class CartProvider<
  T extends Cart = Cart,
  Q extends CartQuery = CartQuery,
  M extends CartMutation = CartMutation
> extends BaseProvider<T, Q, M> {}