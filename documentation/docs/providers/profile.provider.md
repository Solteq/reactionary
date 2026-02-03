[**@reactionary/core**](README.md)

***

[@reactionary/core](README.md) / profile.provider

# profile.provider

## Classes

### `abstract` ProfileProvider

Defined in: [profile.provider.ts:8](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/profile.provider.ts#L8)

Base capability provider, responsible for mutations (changes) and queries (fetches)
for a given business object domain.

#### Extends

- [`BaseProvider`](base.provider.md#baseprovider)

#### Constructors

##### Constructor

> **new ProfileProvider**(`cache`, `context`): [`ProfileProvider`](#profileprovider)

Defined in: [base.provider.ts:13](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L13)

###### Parameters

###### cache

`Cache`

###### context

`RequestContext`

###### Returns

[`ProfileProvider`](#profileprovider)

###### Inherited from

[`BaseProvider`](base.provider.md#baseprovider).[`constructor`](base.provider.md#constructor)

#### Properties

##### cache

> `protected` **cache**: `Cache`

Defined in: [base.provider.ts:10](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L10)

###### Inherited from

[`BaseProvider`](base.provider.md#baseprovider).[`cache`](base.provider.md#cache)

##### context

> `protected` **context**: `RequestContext`

Defined in: [base.provider.ts:11](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L11)

###### Inherited from

[`BaseProvider`](base.provider.md#baseprovider).[`context`](base.provider.md#context)

#### Methods

##### addShippingAddress()

> `abstract` **addShippingAddress**(`payload`): `Promise`\<`Result`\<`Profile`, `NotFoundError`\>\>

Defined in: [profile.provider.ts:39](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/profile.provider.ts#L39)

Creates a new shipping address for the currently authenticated (registered) user.
Does not set it as default automatically.

Usecase: User adds a new shipping address in their profile or during checkout. Ideally, any address manipulation
done at checkout should be considered local to that session, unless the addressbook is empty.

###### Parameters

###### payload

`ProfileMutationAddShippingAddress`

###### Returns

`Promise`\<`Result`\<`Profile`, `NotFoundError`\>\>

##### generateCacheKeyForQuery()

> `protected` **generateCacheKeyForQuery**(`scope`, `query`): `string`

Defined in: [base.provider.ts:32](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L32)

###### Parameters

###### scope

`string`

###### query

`object`

###### Returns

`string`

###### Inherited from

[`BaseProvider`](base.provider.md#baseprovider).[`generateCacheKeyForQuery`](base.provider.md#generatecachekeyforquery)

##### generateDependencyIdsForModel()

> **generateDependencyIdsForModel**(`model`): `string`[]

Defined in: [base.provider.ts:18](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/base.provider.ts#L18)

###### Parameters

###### model

`unknown`

###### Returns

`string`[]

###### Inherited from

[`BaseProvider`](base.provider.md#baseprovider).[`generateDependencyIdsForModel`](base.provider.md#generatedependencyidsformodel)

##### getById()

> `abstract` **getById**(`payload`): `Promise`\<`Result`\<`Profile`, `NotFoundError`\>\>

Defined in: [profile.provider.ts:16](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/profile.provider.ts#L16)

Returns the profile of the currently authenticated (registered) user.

Usecase: Fetch the profile of the logged-in user for display in header, or account settings.

###### Parameters

###### payload

`ProfileQuerySelf`

###### Returns

`Promise`\<`Result`\<`Profile`, `NotFoundError`\>\>

##### getResourceName()

> `protected` **getResourceName**(): `string`

Defined in: [profile.provider.ts:79](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/profile.provider.ts#L79)

Returns the abstract resource name provided by the remote system.

###### Returns

`string`

###### Overrides

[`BaseProvider`](base.provider.md#baseprovider).[`getResourceName`](base.provider.md#getresourcename)

##### makeShippingAddressDefault()

> `abstract` **makeShippingAddressDefault**(`payload`): `Promise`\<`Result`\<`Profile`, `NotFoundError`\>\>

Defined in: [profile.provider.ts:66](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/profile.provider.ts#L66)

Configures an existing shipping address as the default shipping address for the currently authenticated (registered) user.

Usecase: User selects a default shipping address in their profile.

###### Parameters

###### payload

`ProfileMutationMakeShippingAddressDefault`

###### Returns

`Promise`\<`Result`\<`Profile`, `NotFoundError`\>\>

##### removeShippingAddress()

> `abstract` **removeShippingAddress**(`payload`): `Promise`\<`Result`\<`Profile`, `NotFoundError`\>\>

Defined in: [profile.provider.ts:58](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/profile.provider.ts#L58)

Removes an existing shipping address for the currently authenticated (registered) user.

If the removed address was the default shipping address, the default shipping address is set to a random other address.

Usecase: User deletes a shipping address from their profile.

###### Parameters

###### payload

`ProfileMutationRemoveShippingAddress`

###### Returns

`Promise`\<`Result`\<`Profile`, `NotFoundError`\>\>

##### setBillingAddress()

> `abstract` **setBillingAddress**(`payload`): `Promise`\<`Result`\<`Profile`, `NotFoundError`\>\>

Defined in: [profile.provider.ts:77](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/profile.provider.ts#L77)

Sets the current/active billing address for the currently authenticated (registered) user.

Usecase: User sets or updates their billing address in their profile or during checkout.

It was a design decision not to support multiple billing addresses. The billing address represents who you are as the commercial
entity being billed, and as such it makes sense to have a single authoritative billing address.

###### Parameters

###### payload

`ProfileMutationSetBillingAddress`

###### Returns

`Promise`\<`Result`\<`Profile`, `NotFoundError`\>\>

##### update()

> `abstract` **update**(`payload`): `Promise`\<`Result`\<`Profile`, `NotFoundError`\>\>

Defined in: [profile.provider.ts:29](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/profile.provider.ts#L29)

Updates the base profile information of the currently authenticated (registered) user.

TODO: This should include first/lastname.
TODO: In some systems, updating email/phone may require re-verification.
TODO: Handle conflicts if email/phone is already in use by another user.
TODO: In some systems the email might not be editable.

Usecase: Update the user's name, email, or phone number.

###### Parameters

###### payload

`ProfileMutationUpdate`

###### Returns

`Promise`\<`Result`\<`Profile`, `NotFoundError`\>\>

##### updateShippingAddress()

> `abstract` **updateShippingAddress**(`payload`): `Promise`\<`Result`\<`Profile`, `NotFoundError`\>\>

Defined in: [profile.provider.ts:48](https://github.com/Solteq/reactionary/blob/ca9304f3dfc56eb7283e5bdf90b26f13d42dce7d/core/src/providers/profile.provider.ts#L48)

Updates an existing shipping address for the currently authenticated (registered) user.

Usecase: User edits an existing shipping address in their profile. Ideally, any address manipulation
done at checkout should be considered local to that session/order, unless the addressbook is empty.

###### Parameters

###### payload

`ProfileMutationUpdateShippingAddress`

###### Returns

`Promise`\<`Result`\<`Profile`, `NotFoundError`\>\>
