import 'dotenv/config';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';
import type {
  ProductList,
  ProductSearchQueryCreateNavigationFilter,
} from '@reactionary/core';

const testData = {
  product1: {
   sku: '0766623170703',
   },
  product2: {
    sku: '0766623301831',
  },
};

describe.each([PrimaryProvider.COMMERCETOOLS])(
  'Product List - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient(provider);
    });

    describe('Lists', () => {
      describe('Anonymous', () => {
        it('cannot create a new favorite list', async () => {
          const result = await client.productList.addList({
            list: {
              type: 'favorite',
              name: 'My favorite list',
              published: true,
            },
          });
          expect(result.success).toBe(false);
        });
      });

      describe('Registered', () => {
        beforeEach(async () => {
          // create new user and set context to that user, so we have a clean slate for the product lists
          const user = await client.identity.register({
            username: `test-${Math.random()}@example.com`,
            password: 'password',
          });

          if (!user.success) {
            assert.fail('Failed to create user for testing product lists');
          }

          const self = await client.identity.getSelf({});
          if (!self.success) {
            assert.fail('Failed to get self for testing product lists');
          }
          if (self.value.type !== 'Registered') {
            assert.fail('User is not registered');
          }
        });

        it('can create a new favorite list', async () => {
          const result = await client.productList.addList({
            list: {
              type: 'favorite',
              name: 'My favorite list',
              published: true,
            },
          });
          expect(result.success).toBe(true);
          if (!result.success) {
            assert.fail(JSON.stringify(result.error));
          }
          expect(result.value.name).toBe('My favorite list');
          expect(result.value.type).toBe('favorite');
          expect(result.value.published).toBe(true);
          expect(result.value.identifier).toBeDefined();
          expect(result.value.identifier.key).toBeDefined();
          expect(result.value.identifier.listType).toBe('favorite');
        });

        it('can create a new wishlist', async () => {
          const result = await client.productList.addList({
            list: {
              type: 'wish',
              name: 'My wishlist',
              published: true,
            },
          });
          expect(result.success).toBe(true);
          if (!result.success) {
            assert.fail(JSON.stringify(result.error));
          }
          expect(result.value.name).toBe('My wishlist');
          expect(result.value.type).toBe('wish');
          expect(result.value.published).toBe(true);
          expect(result.value.identifier).toBeDefined();
          expect(result.value.identifier.key).toBeDefined();
          expect(result.value.identifier.listType).toBe('wish');
        });

        it('can create a new shopping list', async () => {
          const result = await client.productList.addList({
            list: {
              type: 'shopping',
              name: 'My shopping list',
              published: true,
            },
          });
          expect(result.success).toBe(true);
          if (!result.success) {
            assert.fail(JSON.stringify(result.error));
          }
          expect(result.value.name).toBe('My shopping list');
          expect(result.value.type).toBe('shopping');
          expect(result.value.published).toBe(true);
          expect(result.value.identifier).toBeDefined();
          expect(result.value.identifier.key).toBeDefined();
          expect(result.value.identifier.listType).toBe('shopping');
        });

        it('can create a new requisition list', async () => {
          const result = await client.productList.addList({
            list: {
              type: 'requisition',
              name: 'My requisition list',
              published: true,
            },
          });
          expect(result.success).toBe(true);
          if (!result.success) {
            assert.fail(JSON.stringify(result.error));
          }
          expect(result.value.name).toBe('My requisition list');
          expect(result.value.type).toBe('requisition');
          expect(result.value.published).toBe(true);
          expect(result.value.identifier).toBeDefined();
          expect(result.value.identifier.key).toBeDefined();
          expect(result.value.identifier.listType).toBe('requisition');
        });

        it('can get a list by id', async () => {
          const result = await client.productList.addList({
            list: {
              type: 'requisition',
              name: 'My requisition list',
              published: true,
            },
          });
          expect(result.success).toBe(true);
          if (!result.success) {
            assert.fail(JSON.stringify(result.error));
          }
          const createdList = await client.productList.getById({
            identifier: result.value.identifier,
          });
          expect(createdList.success).toBe(true);
          if (!createdList.success) {
            assert.fail(JSON.stringify(createdList.error));
          }
          expect(createdList.value.name).toBe('My requisition list');
          expect(createdList.value.type).toBe('requisition');
          expect(createdList.value.published).toBe(true);
          expect(createdList.value.identifier).toEqual(result.value.identifier);
        });

        it('can filter lists by type', async () => {
          const result = await client.productList.addList({
            list: {
              type: 'shopping',
              name: 'My shopping list',
              published: true,
            },
          });
          const result2 = await client.productList.addList({
            list: {
              type: 'wish',
              name: 'My wishlist',
              published: true,
            },
          });

          expect(result.success).toBe(true);
          expect(result2.success).toBe(true);

          if (result.success && result2.success) {
            const shoppingLists = await client.productList.queryLists({
              search: {
                listType: 'shopping',
                paginationOptions: {
                  pageNumber: 1,
                  pageSize: 10,
                },
              },
            });
            expect(shoppingLists.success).toBe(true);
            if (shoppingLists.success) {
              expect(shoppingLists.value.items.length).toBe(1);
              expect(shoppingLists.value.items[0].type).toBe('shopping');
            }

            const wishLists = await client.productList.queryLists({
              search: {
                listType: 'wish',
                paginationOptions: {
                  pageNumber: 1,
                  pageSize: 10,
                },
              },
            });
            expect(wishLists.success).toBe(true);
            if (!wishLists.success) {
              assert.fail(JSON.stringify(wishLists.error));
            }
            expect(wishLists.value.items.length).toBe(1);
            expect(wishLists.value.items[0].type).toBe('wish');
          }
        });

        it('can pageinate through lists', async () => {
          for (let i = 0; i < 3; i++) {
            const result = await client.productList.addList({
              list: {
                type: 'favorite',
                name: `My favorite list ${i}`,
                published: true,
              },
            });
            expect(result.success).toBe(true);
          }

          const paginatedResult = await client.productList.queryLists({
            search: {
              listType: 'favorite',
              paginationOptions: {
                pageNumber: 1,
                pageSize: 2,
              },
            },
          });

          expect(paginatedResult.success).toBe(true);
          if (!paginatedResult.success) {
            assert.fail(JSON.stringify(paginatedResult.error));
          }
          expect(paginatedResult.value.items.length).toBe(2);
          expect(paginatedResult.value.pageNumber).toBe(1);
          expect(paginatedResult.value.pageSize).toBe(2);
          expect(paginatedResult.value.totalCount).toBeGreaterThanOrEqual(3);
          expect(paginatedResult.value.totalPages).toBeGreaterThanOrEqual(2);

          const page2 = await client.productList.queryLists({
            search: {
              ...paginatedResult.value.identifier,
              paginationOptions: {
                pageNumber: 2,
                pageSize: 2,
              },
            },
          });

          expect(page2.success).toBe(true);
          if (!page2.success) {
            assert.fail(JSON.stringify(page2.error));
          }
          expect(page2.value.items.length).toBeGreaterThanOrEqual(1);
          expect(page2.value.pageNumber).toBe(2);
          expect(page2.value.pageSize).toBe(2);
          expect(page2.value.totalCount).toBeGreaterThanOrEqual(3);
          expect(page2.value.totalPages).toBeGreaterThanOrEqual(2);

          expect(page2.value.items[0].identifier).not.toEqual(
            paginatedResult.value.items[0].identifier,
          );
          expect(page2.value.items[0].identifier).not.toEqual(
            paginatedResult.value.items[1].identifier,
          );
        });

        it('can rename a list', async () => {
          const result = await client.productList.addList({
            list: {
              type: 'favorite',
              name: `My favorite list`,
              published: true,
            },
          });

          expect(result.success).toBe(true);
          if (!result.success) {
            assert.fail(JSON.stringify(result.error));
          }
          const updatedList = await client.productList.updateList({
            list: result.value.identifier,
            name: 'My renamed favorite list',
          });

          expect(updatedList.success).toBe(true);
          if (updatedList.success) {
            expect(updatedList.value.name).toBe('My renamed favorite list');
            expect(updatedList.value.identifier.key).toEqual(result.value.identifier.key);
            expect(updatedList.value.identifier.listType).toEqual(result.value.identifier.listType);

          }
        });

        it('can update the description and other metadata of a list', async () => {
          const result = await client.productList.addList({
            list: {
              type: 'favorite',
              name: `My favorite list`,
              published: true,
            },
          });

          expect(result.success).toBe(true);
          if (!result.success) {
            assert.fail(JSON.stringify(result.error));
          }
          const updatedList = await client.productList.updateList({
            list: result.value.identifier,
            description: 'my description of the list',
          });

          expect(updatedList.success).toBe(true);
          if (!updatedList.success) {
            assert.fail(JSON.stringify(updatedList.error));
          }
          expect(updatedList.value.description).toBe(
            'my description of the list',
          );
          expect(updatedList.value.identifier.key).toEqual(result.value.identifier.key);
          expect(updatedList.value.identifier.listType).toEqual(result.value.identifier.listType);

        });

        it('can delete a list', async () => {
          const result = await client.productList.addList({
            list: {
              type: 'favorite',
              name: `My favorite list`,
              published: true,
            },
          });

          expect(result.success).toBe(true);
          if (!result.success) {
            assert.fail(JSON.stringify(result.error));
          }
          const deleteResult = await client.productList.deleteList({
            list: result.value.identifier,
          });

          if (!deleteResult.success) {
            assert.fail(JSON.stringify(deleteResult.error));
          }
          const getResult = await client.productList.getById({
            identifier: result.value.identifier,
          });

          expect(getResult.success).toBe(false);
          if (getResult.success) {
            assert.fail('Should not be able to get a deleted list');
          }
          expect(getResult.error.type).toBe('NotFound');
        });
      });
    });

    describe('Items', () => {
      let list: ProductList;

      beforeEach(async () => {
        // create new user and set context to that user, so we have a clean slate for the product lists
        const user = await client.identity.register({
          username: `test-${Math.random()}@example.com`,
          password: 'password',
        });

        if (!user.success) {
          assert.fail('Failed to create user for testing product lists');
        }

        const self = await client.identity.getSelf({});
        if (!self.success) {
          assert.fail('Failed to get self for testing product lists');
        }
        if (self.value.type !== 'Registered') {
          assert.fail('User is not registered');
        }

        const result = await client.productList.addList({
          list: {
            type: 'favorite',
            name: `My favorite list`,
            published: true,
          },
        });
        expect(result.success).toBe(true);
        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }
        list = result.value;
        expect(list.identifier).toBeDefined();
        expect(list.identifier.key).toBeDefined();
        expect(list.identifier.listType).toBe('favorite');
        expect(list.type).toBe('favorite');
      });

      it('can query items in an empty list', async () => {
        const result = await client.productList.queryListItems({
          search: {
            list: list.identifier,
            paginationOptions: {
              pageNumber: 1,
              pageSize: 10,
            },
          },
        });

        expect(result.success).toBe(true);
        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }
        expect(result.value.items.length).toBe(0);
        expect(result.value.pageNumber).toBe(1);
        expect(result.value.pageSize).toBe(10);
        expect(result.value.totalCount).toBe(0);
        expect(result.value.totalPages).toBe(0);
      });

      it('can add an item to a list', async () => {
        const result = await client.productList.addItem({
          list: list.identifier,
          listItem: {
            variant: {
              sku: testData.product1.sku,
            },
            quantity: 2,
            notes: 'This is a note about the item',
            order: 0,
          },
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }
        expect(result.value.identifier).toBeDefined();
        expect(result.value.identifier.key).toBeDefined();
        expect(result.value.identifier.list).toEqual(list.identifier);
        expect(result.value.variant.sku).toBe(testData.product1.sku);
        expect(result.value.quantity).toBe(2);
      });

      it('can query items in an non-empty list', async () => {
        const result = await client.productList.addItem({
          list: list.identifier,
          listItem: {
            variant: {
              sku: testData.product1.sku,
            },
            quantity: 2,
            notes: 'This is a note about the item',
            order: 0,
          },
        });

        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }

        const result2 = await client.productList.queryListItems({
          search: {
            list: list.identifier,
            paginationOptions: {
              pageNumber: 1,
              pageSize: 10,
            },
          },
        });

        if (!result2.success) {
          assert.fail(JSON.stringify(result2.error));
        }

        expect(result2.success).toBe(true);
        expect(result2.value.items.length).toBe(1);
        expect(result2.value.pageNumber).toBe(1);
        expect(result2.value.pageSize).toBe(10);
        expect(result2.value.totalCount).toBe(1);
        expect(result2.value.totalPages).toBe(1);

        expect(result2.value.items[0].identifier).toEqual(
          result.value.identifier,
        );
        expect(result2.value.items[0].variant.sku).toBe(testData.product1.sku);
        expect(result2.value.items[0].quantity).toBe(2);
        expect(result2.value.items[0].notes).toBe(
          'This is a note about the item',
        );
      });

      it('can remove an item from a list', async () => {
        const addResult = await client.productList.addItem({
          list: list.identifier,
          listItem: {
            variant: {
              sku: testData.product1.sku,
            },
            quantity: 2,
            notes: 'This is a note about the item',
            order: 0,
          },
        });

        expect(addResult.success).toBe(true);
        if (!addResult.success) {
          assert.fail(JSON.stringify(addResult.error));
        }
        const deleteResult = await client.productList.deleteItem({
          listItem: addResult.value.identifier,
        });

        if (!deleteResult.success) {
          assert.fail(JSON.stringify(deleteResult.error));
        }

        const result2 = await client.productList.queryListItems({
          search: {
            list: list.identifier,
            paginationOptions: {
              pageNumber: 1,
              pageSize: 10,
            },
          },
        });

        if (!result2.success) {
          assert.fail(JSON.stringify(result2.error));
        }
        expect(result2.value.items.length).toBe(0);
        expect(result2.value.pageNumber).toBe(1);
        expect(result2.value.pageSize).toBe(10);
        expect(result2.value.totalCount).toBe(0);
        expect(result2.value.totalPages).toBe(0);
      });

      it('can update the quantity of an item in a list', async () => {
        const result = await client.productList.addItem({
          list: list.identifier,
          listItem: {
            variant: {
              sku: testData.product1.sku,
            },
            quantity: 2,
            notes: 'This is a note about the item',
            order: 0,
          },
        });
        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }
        const updatedItem = await client.productList.updateItem({
          listItem: result.value.identifier,
          quantity: 5,
        });

        if (!updatedItem.success) {
          console.log(updatedItem.error);
          assert.fail();
        }

        expect(updatedItem.value.quantity).toBe(5);
        expect(updatedItem.value.identifier).toEqual(result.value.identifier);

        const result2 = await client.productList.queryListItems({
          search: {
            list: list.identifier,
            paginationOptions: {
              pageNumber: 1,
              pageSize: 10,
            },
          },
        });

        if (!result2.success) {
          assert.fail(JSON.stringify(result2.error));
        }
        expect(result2.value.items.length).toBe(1);
        expect(result2.value.pageNumber).toBe(1);
        expect(result2.value.pageSize).toBe(10);
        expect(result2.value.totalCount).toBe(1);
        expect(result2.value.totalPages).toBe(1);

        expect(result2.value.items[0].identifier).toEqual(
          result.value.identifier,
        );
        expect(result2.value.items[0].variant.sku).toBe(testData.product1.sku);
        expect(result2.value.items[0].quantity).toBe(5);
        expect(result2.value.items[0].notes).toBe(
          'This is a note about the item',
        );
      });

      it('can update the notes of an item in a list', async () => {
        const result = await client.productList.addItem({
          list: list.identifier,
          listItem: {
            variant: {
              sku: testData.product1.sku,
            },
            quantity: 2,
            notes: 'This is a note about the item',
            order: 0,
          },
        });
        if (!result.success) {
          assert.fail(JSON.stringify(result.error));
        }
        const updatedItem = await client.productList.updateItem({
          listItem: result.value.identifier,
          notes: 'This is an updated note about the item',
        });

        if (!updatedItem.success) {
          console.log(updatedItem.error);
          assert.fail();
        }

        expect(updatedItem.value.notes).toBe('This is an updated note about the item');
        expect(updatedItem.value.identifier).toEqual(result.value.identifier);

        const result2 = await client.productList.queryListItems({
          search: {
            list: list.identifier,
            paginationOptions: {
              pageNumber: 1,
              pageSize: 10,
            },
          },
        });

        if (!result2.success) {
          assert.fail(JSON.stringify(result2.error));
        }
        expect(result2.value.items.length).toBe(1);
        expect(result2.value.pageNumber).toBe(1);
        expect(result2.value.pageSize).toBe(10);
        expect(result2.value.totalCount).toBe(1);
        expect(result2.value.totalPages).toBe(1);

        expect(result2.value.items[0].identifier).toEqual(
          result.value.identifier,
        );
        expect(result2.value.items[0].variant.sku).toBe(testData.product1.sku);
        expect(result2.value.items[0].quantity).toBe(2);
        expect(result2.value.items[0].notes).toBe(
          'This is an updated note about the item',
        );
      });

      it('cannot have a quantity of 0 or less', async () => {
        const result = await client.productList.addItem({
          list: list.identifier,
          listItem: {
            variant: {
              sku: testData.product1.sku,
            },
            quantity: 0,
            notes: 'This is a note about the item',
            order: 0,
          },
        });
        if (result.success) {
          assert.fail('Should not be able to add an item with quantity of 0');
        }
        expect(result.success).toBe(false);
        console.dir(result.error, { depth: null });
        expect(result.error.type).toBe('InvalidInput');
      });

    });
  },
);
