import { Price } from '../schemas/models/price.model';
import { PriceMutation } from '../schemas/mutations/price.mutation';
import { PriceQuery } from '../schemas/queries/price.query';
import { BaseProvider } from './base.provider';

export abstract class PriceProvider<
  T extends Price = Price,
  Q extends PriceQuery = PriceQuery,
  M extends PriceMutation = PriceMutation
> extends BaseProvider<T, Q, M> {}
