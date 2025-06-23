import { Product } from '../schemas/models/product.model';
import { ProductMutation } from '../schemas/mutations/product.mutation';
import { ProductQuery } from '../schemas/queries/product.query';
import { BaseProvider } from './base.provider';

export abstract class ProductProvider<
  T extends Product = Product,
  Q extends ProductQuery = ProductQuery,
  M extends ProductMutation = ProductMutation
> extends BaseProvider<T, Q, M> {
}
