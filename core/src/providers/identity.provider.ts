import { Identity } from "../schemas/models/identity.model";
import { IdentityQuery } from "../schemas/queries/identity.query";
import { IdentityMutation } from "../schemas/mutations/identity.mutation";
import { BaseProvider } from "./base.provider";

export abstract class IdentityProvider<
  T extends Identity = Identity,
  Q extends IdentityQuery = IdentityQuery,
  M extends IdentityMutation = IdentityMutation
> extends BaseProvider<T, Q, M> {}