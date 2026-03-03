import type { ProductList, ProductListItem, ProductListItemPaginatedResult, ProductListPaginatedResult } from "../schemas/models/product-list.model.js";
import type { ProductListItemMutationCreate, ProductListItemMutationDelete, ProductListItemMutationUpdate, ProductListMutationCreate, ProductListMutationDelete, ProductListMutationUpdate } from "../schemas/mutations/product-list.mutation.js";
import type { ProductListQuery, ProductListQueryById } from "../schemas/queries/product-list.query.js";
import { type ProductListItemsQuery } from "../schemas/queries/product-list.query.js";
import type { Result } from "../schemas/result.js";
import { BaseProvider } from "./base.provider.js";

/**
 * The product list provider is a general purpose provider for creating various types of product lists, such as favorite lists, projects, wishlists, requisitionlists, etc
 * It supports having multiples of each list, so that users can have multiple wishlists for example. The lists are identified by a key, which is passed in the query for the various methods.
 * The provider also supports having different types of lists, which can be used to differentiate between wishlists, favorite lists, etc.
 * The type is also passed in the query for the various methods.
 *
 * Some systems might only support single entries of each type, but the general case is to support multiples.
 */
export abstract class ProductListProvider extends BaseProvider {

  protected getResourceName(): string {
    return 'product-lists';
  }

  /**
   * Usecase: in the frontend you want to fetch a specific list, for example a specific wishlist, to show the details of the list, such as the name, description, image, etc.
   * you might have stored the identifier from an earlier session or looked it up previously.
   * @param payload
   */
  public abstract getById(payload: ProductListQueryById): Promise<Result<ProductList>>;


  /**
   * Usecase: in the frontend you want to see if the customer already has a favorite list or wishlist, to which the product can be added.
   * In complex scenarios you might want to fetch a list of wishlists, and allow customer to pick which one to add the product-variant to.
   *
   * @param query
   */
  public abstract queryLists(query: ProductListQuery): Promise<Result<ProductListPaginatedResult>>;


  /**
   * Usecase: in the frontend, if customer has clicked the "add to favorites list", and you have used the queryLists to find out there is no
   * preexistiing list, you can use this method to create a new favorite list.
   *
   * Usecase: in frontend, if customer has chosing "add to favorites list", and you allow multiple lists, you can use this method to create a new favorite list,
   * which the customer can then add the product to.
   * @param mutation
   */
  public abstract addList(mutation: ProductListMutationCreate): Promise<Result<ProductList>>;

  /**
   *
   * Usecase: update name of list, or other metadata related to the list, such as "this is my summer wishlist", or "this is my favorite list for cameras".
   * @param mutation
   */
  public abstract updateList(mutation: ProductListMutationUpdate): Promise<Result<ProductList>>;

  /**
   * Usecase: customer wants to delete a list, such as "delete my summer wishlist", including all the product list items
   * @param mutation
   */
  public abstract deleteList(mutation: ProductListMutationDelete): Promise<Result<void>>;

  /**
   * Usecase: in the frontend you want to show a list of the products in the customers wishlist.
   * @param query
   */
  public abstract queryListItems(query: ProductListItemsQuery): Promise<Result<ProductListItemPaginatedResult>>;

  /**
   * Usecase: Add a new product-variant to a list
   * @param mutation
   */
  public abstract addItem(mutation: ProductListItemMutationCreate): Promise<Result<ProductListItem>>;

  /**
   * Usecase: Remove a product-variant from a list.
   * @param mutation
   */
  public abstract deleteItem(mutation: ProductListItemMutationDelete): Promise<Result<void>>;

  /**
   * Usecase: Update the quantity of a product-variant in a list.
   * @param mutation
   */
  public abstract updateItem(mutation: ProductListItemMutationUpdate): Promise<Result<ProductListItem>>;

}
