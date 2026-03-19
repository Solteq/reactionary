# Signing up a business user

In Reactionary, the model for business users and their organisations is such, that we seperate the two from eachother fully.
All companies are more or less treated as a special kind of user, for which some people have the right to act on behalf of.

This means, as a user, you do not have a parent organization. Instead you have a list of organizations you have been invited to play a role in. And that role can be either `employee`, `manager` or `admin`. 

## The roles
For now we identify only three roles, and a user can have only one role in a company.

This means these roles are inclusive of eachother, so an 
- `employee` can probably place an order (up to a certain size), access and change requisition lists
- `manager` can do everything the employee can do, but can (depending on backend), maybe see all orders and carts related to that company, and can probably approve turning a cart into an order. Manager can change roles of other employees in the organization.
- `admin` can do everything the manager can do, but also invite users to act in his company. And remove them again.


## Self registration
In order to sign up for a B2B account, the user must first register a personal account. It is in context of this account, he will then request the Company account to be set up. 
To do this, he must provide som basic information, the merchant can use to gauge (either manually or via automation) if this is a trustworthy request or not.
The account that makes the request, will be made the `admin` of the company account.

In the backend this might manifest either as some custom type, or possibly just  jira-ticket, or zendesk ticket, or maybe it will be represented as a partially created organisation that just needs to be approved.

To ask for the registration to take place do

```ts
      const data = {
          billingAddress: {
            countryCode: 'DK',
            city: 'Copenhagen',
            streetAddress: 'Test Street',
            streetNumber: '1',
            postalCode: '1999',
            firstName: 'Test',
            lastName: 'Org admin',
            identifier: {
              nickName: 'default-billing-address'
            },
            region: ''
          },
          name: `Test Organization`,
          taxIdentifier: `DK12345678`,
          pointOfContact: {
            email:  `my-cfo@example.com`,
            phone: '+4512345678',
          },
          dunsIdentifier: 'DUNS-123456789',
          tinIdentifier: 'TIN-123456789',
        };
      }
      const result = await client.companyRegistration.requestRegistration(data);
      if (!result.succes) {
        // deal with error
      }
      if (result.value.status === 'pending') {
        // guess i have to wait....
      }
      if (result.value.status === 'active') {
        // yay, i was auto-approved and can use it immediatly
      }
```

Sometimes, even when autoapproval systems are in place, they happen asynchroniously. Therefore, you can use the registration identifier to check if there are any updates.

As the consumer, you are responsible for saving the request identifier. Optionally, by sending the customer an email with a check-status link that embeds the identifier.

To check if there are any updates on your request, do
```ts
        const checkStatusResult = await client.companyRegistration.checkRequestStatus({
          requestIdentifier: result.value.identifier
        });
        if (!checkStatusResult.success) {
          assert.fail(JSON.stringify(checkStatusResult.error));
        }

        if (checkStatusResult.value.status === 'approved') {
          // yay....
        }
```

## ERP based organization creation only
If your site does not want to offer self-signup, just dont enable the capability. Then all company information will have to find its way to the backend in some other way.

You can also opt to create an email version of the capability that just turns the request into an email and sends it to customer service.

## Manage the company
If you are the company admin, you MIGHT be able to do self-administration of the companys shipping address book.
In many B2B scenarios you want to lock down the shipping addresses, so a rogue employee cant have 40 computers shipped to "The docks".

Use the `Company#isSelfManagementOfShippingAddressesAllowed` to check if you are allowed to make any changes or not.
In a similar vein, the company also indicates if you are willing to allow the employee to write in a different shipping addres or not. This is recorded in `Company#isCustomAddressesAllowed`. The difference between the two, is that the first decides if the user is able to change a permanent shipping address and the latter is wheter he can add an adhoc address during checkout.

To add a new shipping address do
```ts
    const companyResponse = await client.company.getById({
      identifier: companyIdentifier,
    });

    if (!companyResponse.success) {
      // where did it go? How is it even possible that i have a stored reference to a company that doesn't exist?
      // i suppose i could have lost access rights.
      assert.fail(JSON.stringify(companyResponse.error));
    }

    company = companyResponse.value;

    const newAddress: Address = {
      identifier: {
        nickName: 'Home',
      },
      firstName: 'John',
      lastName: 'Doe',
      streetAddress: 'Main Street',
      streetNumber: '123',
      city: 'Metropolis',
      region: 'State',
      postalCode: '12345',
      countryCode: 'US',
    };
    const updatedOrg = await client.company.addShippingAddress({
      company: company.identifier,
      address: newAddress,
    });
```

One of the shipping addresses will be the default suggestion. You can control this with
```ts
      const moreUpdatedOrg = await client.company.makeShippingAddressDefault({
        company: company.identifier,
        addressIdentifier: newAddress.identifier,
      });

      if (moreUpdatedOrg.success) {
        console.log(moreUpdatedOrg.shippingAddress);
      }

```
Any non-default shipping address, is available in the `alternativeShippingAddresses` array.



### Point of contact
The Company has a `pointOfContact` field. This is supposed to be the contact information for either the CFO or CEO of the company. Something fincance can use to contact the company for verification and/or disputes.


## Employee - invitations
A company can have multiple employees buying on its behalf. In order to add a new employee, an `admin` can issue an invitation. 
The invitation is linked to an email, so even if the user in question is not on the platform yet, he can be invited.

This is the only way to add new users to an organisation. Allowing direct adds by the admin, would expose who is and who isn't already on the platform. 

So the flow is, Admin => Employee invitation.

The invitation contains, when issued, a token. This is the only time this token is made available. The frontend/BFF is responsible for dealing with distribution of this token to the intended email. This can be done via any number of technical aspects. (SES, Sendgrid, Twillio, etc).

To issue an invitation do
```ts
      const invite = await client.employeeInvitation.inviteEmployee({
        company: companyIdentifier,
        email,
        'manager',
      });

      if (!invite.success) {
        assert.fail(JSON.stringify(invite.error));
      }

      const linkToAcceptInvitationPage = `/my-account/accept-invitation/?invite_id=${invite.value.identifier.key}&token=${invite.value.secretToken}`;

      await sendEmailNotificationAboutInvitation(email, linkToAcceptInvitationPage);
```

The token is time-sensitve, and by default only valid for 30 days, after which a new invitation will need to be issued.

### Accepting the invitation
In order to accept the invitation, the user session must be logged in, and have the same email as the one the invitation was issued to, and be in time, and have the token match. 

So in your frontend, you need to have a guard that ensures the user is logged in when following the link you embedded in the email.
This way, if the user is new, he can sign up first, and then accept the invitation. And if he is already signed up, he can just log in, and accept the invitation.

```ts
      const identity =  await client.identity.getSelf({});
      if (!identity.success) {
        return Error('Unable to look up identity');
      }

      if (identity.value.type !== 'Registered') {
        return Redirect('/login', { forwardTo: currentUrl });
      }


      const profileResponse = await client.profile.getById({ 
        identifier: identity.value.id
      })

      if (!profileResponse.success) {
        return Error('Unable to look up profile')
      }

      const accepted = await client.employeeInvitation.acceptInvitation({
        invitationIdentifier: { key: urlParams.invite_id },
        securityToken: urlParams.token,
        currentUserEmail: profile.email,
      });

      if (accepted.success) {
        // yay, i can now access the organization i was invited into
        Redirect(`/my-account/my-companies/${accepted.value.organization.taxIdentifier}`);
      }
```


### Revoking an invitation
Sometimes it happens that an invite goes where it isn't supposed. And in this case, an `admin` can get a list of all invitations sent for a company, find the wrong one, and revoke it.

To get the list of invitations do
```ts
      const listResult = await client.employeeInvitation.listInvitations({
        search: {
          company: companyIdentifier,
          paginationOptions: {
            pageNumber: 1,
            pageSize: 20,
          },
        },
      });

      if (!listResult.success) {
        return [];
      }

      listResult.value.items.map(x => {
        console.log(x);
      });
```


Administrator can then review them, and find the ones that need to be pulled, and revoke it by
```ts
      const revoked = await client.employeeInvitation.revokeInvitation({
        invitationIdentifier: invite.identifier,
      });
      if (!revoked.success) {
        assert.fail(JSON.stringify(revoked.error));
      }
```

## Design Decisions
It was decided to make business profiles something you assumed, rather than something you are.
This allows for simultanious b2b and b2c support in the same channel, because you choose to act, on behalf of a company, rather than having your login be limited to a single parent company.

Not only is this model much easier to understand, it also makes it possible to perform acts on multiple company resources at once.
You could have an "add to all my companies carts" button rather than having the user have to focus on a single company at a time.

This can be useful when the company represents  a division, or a project related subsidiary.

Having an "invitation only" way of allowing new users to be added (aside from via merchant UI and direct api control), makes it more in line with how CIAM solutions would map this relationship. Your identity, and your association to a company are two seperate concerns.


