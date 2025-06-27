import z from 'zod';
import { Inventory } from '../schemas/models/inventory.model';
import { InventoryQuery } from '../schemas/queries/inventory.query';
import { InventoryMutation } from '../schemas/mutations/inventory.mutation';
import { BaseProvider } from './base.provider';

export abstract class InventoryProvider<
  T extends Inventory = Inventory,
  Q extends InventoryQuery = InventoryQuery,
  M extends InventoryMutation = InventoryMutation
> extends BaseProvider<T, Q, M> {}
