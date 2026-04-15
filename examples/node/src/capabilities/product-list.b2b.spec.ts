import 'dotenv/config';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, PrimaryProvider } from '../utils.js';
import type {
  Company,
  CompanyIdentifier,
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

  requestTemplate: (ts: string) => {
    return {
      adminUserEmail: `unittest-orgadmin+${ts}@example.com`,
      billingAddress: {
        countryCode: 'DK',
        city: 'Copenhagen',
        streetAddress: 'Test Street',
        streetNumber: '1',
        postalCode: '1999',
        firstName: 'Test',
        lastName: 'Org admin',
        identifier: {
          nickName: 'default-billing-address',
        },
        region: '',
      },
      name: `TestOrg AutoApprove ${ts}`,
      taxIdentifier: `TE` + ts,
      pointOfContact: {
        email: `test-contact+${ts}@example.com`,
        phone: '+4512345678',
      },
      dunsIdentifier: 'DUNS-123456789',
      tinIdentifier: 'TIN-123456789',
    };
  },


};

describe.each([PrimaryProvider.COMMERCETOOLS])(
  'Product List B2B - %s',
  (provider) => {
    let client: ReturnType<typeof createClient>;
    let company: Company;
    let companyIdentifier: CompanyIdentifier;
    let testOrg: ReturnType<typeof testData.requestTemplate>;
    let identityUsername = '';



    beforeEach(() => {
      client = createClient(provider);
    });


  beforeEach(async () => {
    client = createClient(provider);
    const time = new Date().getTime();
    testOrg = testData.requestTemplate(time.toString());
    identityUsername = `testuser+${Date.now()}@example.com`;

    const identity = await client.identity.register({
      username: identityUsername,
      password: 'password1235!',
    });

    if (!identity.success) {
      assert.fail(JSON.stringify(identity.error));
    }

    expect(identity.value.type === 'Registered').toBeTruthy();

    const orgCreateResponse =
      await client.companyRegistration.requestRegistration(testOrg);

    if (!orgCreateResponse.success) {
      assert.fail(JSON.stringify(orgCreateResponse.error));
    }
    expect(orgCreateResponse.value.status).toBe('pending');

    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const checkStatusResult =
        await client.companyRegistration.checkRequestStatus({
          requestIdentifier: orgCreateResponse.value.identifier,
        });

      if (!checkStatusResult.success) {
        assert.fail(JSON.stringify(checkStatusResult.error));
      }
      if (checkStatusResult.value.status === 'approved') {
        break;
      }
      if (i == 19) {
        assert.fail(
          'Company registration was not approved within expected time',
        );
      }
    }

    companyIdentifier = orgCreateResponse.value.companyIdentifier;
  }, 25000);




    describe('Lists', () => {

      it('can create a list and get it by ID', async () => {
        const b2bReqList = await client.productList.addList({
          company: companyIdentifier,
          list: {
            type: 'requisition',
            name: 'My requisition list',
            published: true,
          }
        });

        if (!b2bReqList.success) {
          assert.fail(JSON.stringify(b2bReqList.error));
        }

        const sameList = await client.productList.getById({
          identifier: b2bReqList.value.identifier,
        });

        if (!sameList.success) {
          assert.fail(JSON.stringify(sameList.error));
        }

        expect(b2bReqList.value.identifier.key).toBe(sameList.value.identifier.key);
      });



        it('can filter lists by type', async () => {
          const result = await client.productList.addList({
            company: companyIdentifier,
            list: {
              type: 'shopping',
              name: 'My shopping list',
              published: true,
            },
          });
          const result2 = await client.productList.addList({
            company: companyIdentifier,
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
                company: companyIdentifier,
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
                company: companyIdentifier,
              },
            });
            expect(wishLists.success).toBe(true);
            if (!wishLists.success) {
              assert.fail(JSON.stringify(wishLists.error));
            }
            expect(wishLists.value.items.length).toBe(1);
            expect(wishLists.value.items[0].type).toBe('wish');


            // show that it doesn't show if we dont provide the company id
            const noCompanyId = await client.productList.queryLists({
              search: {
                listType: 'wish',
                paginationOptions: {
                  pageNumber: 1,
                  pageSize: 10,
                },
              }
            });

            if (noCompanyId.success) {
              expect(noCompanyId.value.items.length).toBe(0);
            } else {
              assert.fail(JSON.stringify(noCompanyId.error));
            }

          }
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
            company: companyIdentifier,
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
            company: companyIdentifier,
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

      it('can add an item to a list', async () => {
        const listResult = await client.productList.addList({
          company: companyIdentifier,
          list: {
            type: 'favorite',
            name: `My favorite list`,
            published: true,
          },
        });
        if (!listResult.success) {
          assert.fail(JSON.stringify(listResult.error));
        }

        const result = await client.productList.addItem({
          list: listResult.value.identifier,
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
        expect(result.value.identifier.list.key).toEqual(listResult.value.identifier.key);
        expect(result.value.identifier.list.user).toEqual(listResult.value.identifier.user);
        expect(result.value.variant.sku).toBe(testData.product1.sku);
        expect(result.value.quantity).toBe(2);
      });

      describe('admins', () => {
        let buyerEmail: string;
        let buyerPublishedList: ProductList;
        let buyerUnpublishedList: ProductList;

        beforeEach(async () => {
          buyerEmail = `buyer+${Date.now()}@example.com`;

          // invite buyer to the company using the admin user
          const invite = await client.employeeInvitation.inviteEmployee({
            company: companyIdentifier,
            email: buyerEmail,
            role: 'employee',
          });

          if (!invite.success) {
            assert.fail(JSON.stringify(invite.error));
          }

          // register as buyer and accept the invite
          await client.identity.logout({});
          const buyerIdentity = await client.identity.register({
            username: buyerEmail,
            password: 'password1235!',
          });

          if (!buyerIdentity.success) {
            assert.fail(JSON.stringify(buyerIdentity.error));
          }

          const accepted = await client.employeeInvitation.acceptInvitation({
            invitationIdentifier: invite.value.identifier,
            securityToken: invite.value.securityToken,
            currentUserEmail: buyerEmail,
          });

          if (!accepted.success) {
            assert.fail(JSON.stringify(accepted.error));
          }

          // create a published list as buyer
          const publishedResult = await client.productList.addList({
            company: companyIdentifier,
            list: {
              type: 'shopping',
              name: 'Buyer published list',
              published: true,
            },
          });

          if (!publishedResult.success) {
            assert.fail(JSON.stringify(publishedResult.error));
          }
          buyerPublishedList = publishedResult.value;

          // create an unpublished list as buyer
          const unpublishedResult = await client.productList.addList({
            company: companyIdentifier,
            list: {
              type: 'shopping',
              name: 'Buyer unpublished list',
              published: false,
            },
          });

          if (!unpublishedResult.success) {
            assert.fail(JSON.stringify(unpublishedResult.error));
          }
          buyerUnpublishedList = unpublishedResult.value;

          // switch back to admin user
          await client.identity.logout({});
          const adminLogin = await client.identity.login({
            username: identityUsername,
            password: 'password1235!',
          });

          if (!adminLogin.success) {
            assert.fail(JSON.stringify(adminLogin.error));
          }
        });

        it('admins can see other users lists from same org if they are published', async () => {
          const lists = await client.productList.queryLists({
            search: {
              listType: 'shopping',
              paginationOptions: {
                pageNumber: 1,
                pageSize: 50,
              },
              company: companyIdentifier,
            },
          });

          if (!lists.success) {
            assert.fail(JSON.stringify(lists.error));
          }

          const listKeys = lists.value.items.map((l) => l.identifier.key);
          expect(listKeys).toContain(buyerPublishedList.identifier.key);
          expect(listKeys).not.toContain(buyerUnpublishedList.identifier.key);

          const listCompanies = lists.value.items.map(l => (l.identifier as any).company)
          for(const company of listCompanies) {
            expect(company).toEqual(companyIdentifier);
          }
        });

        it('admins can change other users published lists', async () => {
          // add an item to the published list of the buyer user
          const addResult = await client.productList.addItem({
            list: buyerPublishedList.identifier,
            listItem: {
              variant: { sku: testData.product1.sku },
              quantity: 2,
              notes: 'Admin added this item',
              order: 0,
            },
          });

          if (!addResult.success) {
            assert.fail(JSON.stringify(addResult.error));
          }
          expect(addResult.value.quantity).toBe(2);

          // update the quantity of the item in the list
          const updatedItem = await client.productList.updateItem({
            listItem: addResult.value.identifier,
            quantity: 5,
          });

          if (!updatedItem.success) {
            assert.fail(JSON.stringify(updatedItem.error));
          }
          expect(updatedItem.value.quantity).toBe(5);

          // remove the item from the list
          const deleteItemResult = await client.productList.deleteItem({
            listItem: addResult.value.identifier,
          });

          if (!deleteItemResult.success) {
            assert.fail(JSON.stringify(deleteItemResult.error));
          }

          // rename the list
          const renamedList = await client.productList.updateList({
            list: buyerPublishedList.identifier,
            name: 'Admin renamed published list',
          });

          if (!renamedList.success) {
            assert.fail(JSON.stringify(renamedList.error));
          }
          expect(renamedList.value.name).toBe('Admin renamed published list');
        });

        it('admins can not change other users unpublished lists', async () => {
          // add an item to the unpublished list of the buyer user
          const addResult = await client.productList.addItem({
            list: buyerUnpublishedList.identifier,
            listItem: {
              variant: { sku: testData.product1.sku },
              quantity: 3,
              notes: 'Admin added this to unpublished list',
              order: 0,
            },
          });
          expect(addResult.success).toBe(false);
        });
      });

      describe('buyers', () => {
        let adminPublishedList: ProductList;
        let adminUnpublishedList: ProductList;
        let buyerEmail: string;

        beforeEach(async () => {
          // create a list as admin user, and publish it
          const publishedResult = await client.productList.addList({
            company: companyIdentifier,
            list: {
              type: 'shopping',
              name: 'Admin published list',
              published: true,
            },
          });

          if (!publishedResult.success) {
            assert.fail(JSON.stringify(publishedResult.error));
          }
          adminPublishedList = publishedResult.value;

          const unpublishedResult = await client.productList.addList({
            company: companyIdentifier,
            list: {
              type: 'shopping',
              name: 'Admin unpublished list',
              published: false,
            },
          });

          if (!unpublishedResult.success) {
            assert.fail(JSON.stringify(unpublishedResult.error));
          }
          adminUnpublishedList = unpublishedResult.value;

          // create a new buyer user
          buyerEmail = `buyer+${Date.now()}@example.com`;

          // invite him to the company using the admin user
          const invite = await client.employeeInvitation.inviteEmployee({
            company: companyIdentifier,
            email: buyerEmail,
            role: 'employee',
          });

          if (!invite.success) {
            assert.fail(JSON.stringify(invite.error));
          }

          // accept the invite as the buyer user
          await client.identity.logout({});
          const buyerIdentity = await client.identity.register({
            username: buyerEmail,
            password: 'password1235!',
          });

          if (!buyerIdentity.success) {
            assert.fail(JSON.stringify(buyerIdentity.error));
          }

          const accepted = await client.employeeInvitation.acceptInvitation({
            invitationIdentifier: invite.value.identifier,
            securityToken: invite.value.securityToken,
            currentUserEmail: buyerEmail,
          });

          if (!accepted.success) {
            assert.fail(JSON.stringify(accepted.error));
          }
        });

        it('buyers can see other buyers lists from same org if they are published', async () => {
          const lists = await client.productList.queryLists({
            search: {
              listType: 'shopping',
              paginationOptions: {
                pageNumber: 1,
                pageSize: 50,
              },
              company: companyIdentifier,
            },
          });

          if (!lists.success) {
            assert.fail(JSON.stringify(lists.error));
          }

          const listKeys = lists.value.items.map((l) => l.identifier.key);
          expect(listKeys).toContain(adminPublishedList.identifier.key);
          expect(listKeys).not.toContain(adminUnpublishedList.identifier.key);
        });

        it('buyers cannot change other buyers lists', async () => {
          const updateResult = await client.productList.updateList({
            list: adminPublishedList.identifier,
            name: 'Buyer tried to rename',
          });

          expect(updateResult.success).toBe(false);
        });

        it('buyers cannot delete other buyers lists', async () => {
          const deleteResult = await client.productList.deleteList({
            list: adminPublishedList.identifier,
          });

          expect(deleteResult.success).toBe(false);
        });

        it('buyers cannot load unpublished lists from other buyers, even if they have the list identifier', async () => {
          // switch back to admin to create an unpublished list
          await client.identity.logout({});
          await client.identity.login({
            username: identityUsername,
            password: 'password1235!',
          });

          const unpublishedResult = await client.productList.addList({
            company: companyIdentifier,
            list: {
              type: 'shopping',
              name: 'Admin unpublished list',
              published: false,
            },
          });

          if (!unpublishedResult.success) {
            assert.fail(JSON.stringify(unpublishedResult.error));
          }

          // switch back to buyer user
          await client.identity.logout({});
          await client.identity.login({
            username: buyerEmail,
            password: 'password1235!',
          });

          // try to get the unpublished list by id as the buyer user
          const getResult = await client.productList.getById({
            identifier: unpublishedResult.value.identifier,
          });

          expect(getResult.success).toBe(false);
        });
      });
  },
);
