import {
  type Address,
  type Cache,
  type Fail,
  type IdentityIdentifier,
  type InvalidInputError,
  type NotFoundError,
  ProfileCapability,
  type ProfileFactory,
  type ProfileFactoryOutput,
  type ProfileFactoryWithOutput,
  type ProfileMutationAddShippingAddress,
  ProfileMutationAddShippingAddressSchema,
  type ProfileMutationMakeShippingAddressDefault,
  ProfileMutationMakeShippingAddressDefaultSchema,
  type ProfileMutationRemoveShippingAddress,
  ProfileMutationRemoveShippingAddressSchema,
  type ProfileMutationSetBillingAddress,
  ProfileMutationSetBillingAddressSchema,
  type ProfileMutationUpdate,
  ProfileMutationUpdateSchema,
  type ProfileMutationUpdateShippingAddress,
  ProfileMutationUpdateShippingAddressSchema,
  type ProfileQuerySelf as ProfileQueryById,
  ProfileQueryByIdSchema,
  ProfileSchema,
  Reactionary,
  type RequestContext,
  type Result,
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import * as z from 'zod';
import type { MagentoClient } from '../core/client.js';
import { isMagentoApiError } from '../core/errors.js';
import {
  type MagentoProfileFactory,
  readMagentoAddressNickname,
} from '../factories/profile/profile.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import {
  type MagentoAddress,
  type MagentoCustomer,
  type MagentoDirectoryRegion,
  MagentoDirectoryCountrySchema,
} from '../schema/customer.types.js';
import { handleMagentoProviderError } from '../utils/magento-errors.js';
import { resolveMagentoStoreViewCodeForContext } from '../utils/magento-store-view.js';

const debug = createDebug('reactionary:magento:profile');

/** The region of a Magento address, resolved against the country directory. */
export interface MagentoResolvedRegion {
  region?: { region?: string; region_code?: string; region_id?: number };
  region_id?: number;
}

/** Values `buildMagentoAddress` cannot derive from the core address alone. */
export interface MagentoAddressExtras {
  telephone?: string;
  region?: MagentoResolvedRegion;
}

const CachedCountryRegionsSchema = z.looseObject({
  regions: z.array(
    z.looseObject({ id: z.string(), code: z.string(), name: z.string() }),
  ),
});

const COUNTRY_REGIONS_TTL_SECONDS = 60 * 60 * 24;

/**
 * Builds an `InvalidInput` failure typed as `Fail<NotFoundError>`, which is
 * what the core profile contract declares: core's `Fail` always admits
 * `InvalidInputError`, but TypeScript compares `Fail<A>` with `Fail<B>` by
 * their type arguments, so the failure is rebuilt field by field.
 */
function invalidInput(message: string): Fail<NotFoundError> {
  const failure = error<InvalidInputError>({
    type: 'InvalidInput',
    error: message,
  });
  return { success: false, error: failure.error, meta: failure.meta };
}

function notFound(identifier: unknown): Fail<NotFoundError> {
  return error<NotFoundError>({ type: 'NotFound', identifier });
}

/**
 * The profile capability works on `/V1/customers/me` with the shopper's own
 * customer token. It never reads other customers: an identifier that is not
 * the signed-in customer yields `NotFound`.
 *
 * Magento specifics:
 * - Magento has no address label: the address nickname is stored in the
 *   custom address attribute named by `addressNicknameAttribute`, or in the
 *   address `company` field when that is not configured.
 * - Magento has no customer-level phone: the profile phone is the
 *   `telephone` of the default billing (then shipping) address.
 */
export class MagentoProfileCapability<
  TFactory extends ProfileFactory = MagentoProfileFactory,
> extends ProfileCapability<ProfileFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: ProfileFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: ProfileFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  /**
   * Loads the signed-in customer, provided `identifier` refers to them.
   * Anonymous sessions, rejected tokens and other users are `NotFound`;
   * any other failure is reported as a typed error.
   */
  protected async fetchCustomer(
    identifier: IdentityIdentifier,
  ): Promise<Result<MagentoCustomer, NotFoundError>> {
    const token = await this.magentoApi.getCustomerToken();
    if (!token) {
      return notFound(identifier);
    }

    let customer: MagentoCustomer;
    try {
      customer = await this.magentoApi.getMe();
    } catch (err) {
      if (
        isMagentoApiError(err) &&
        (err.status === 401 || err.status === 403 || err.status === 404)
      ) {
        debug('fetchCustomer: no customer for the current token: %O', err);
        return notFound(identifier);
      }
      return handleMagentoProviderError('fetch customer', err, identifier);
    }

    if (String(customer.id) !== identifier.userId) {
      debug(
        'fetchCustomer: identifier %s is not the signed-in customer',
        identifier.userId,
      );
      return notFound(identifier);
    }

    return success(customer);
  }

  /** Persists the customer through `PUT /V1/customers/me`. */
  protected async saveCustomer(
    action: string,
    identifier: IdentityIdentifier,
    customer: MagentoCustomer,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    try {
      const updated = await this.magentoApi.updateMe(customer);
      return success(this.factory.parseProfile(this.context, updated));
    } catch (err) {
      return handleMagentoProviderError(action, err, identifier);
    }
  }

  protected getAddressNickname(address: MagentoAddress): string {
    return readMagentoAddressNickname(
      address,
      this.config.addressNicknameAttribute,
    );
  }

  /** The profile phone: the default billing (then shipping) address telephone. */
  protected getProfilePhone(customer: MagentoCustomer): string | undefined {
    const addresses = customer.addresses ?? [];
    const byId = (id: string | undefined) =>
      id === undefined
        ? undefined
        : addresses.find((a) => String(a.id) === id)?.telephone;
    return (
      byId(customer.default_billing) || byId(customer.default_shipping) || undefined
    );
  }

  protected buildMagentoAddress(
    address: Address,
    flags: { default_billing?: boolean; default_shipping?: boolean } = {},
    existing?: MagentoAddress,
    extras: MagentoAddressExtras = {},
  ): MagentoAddress {
    const nickName = address.identifier.nickName;
    const nicknameAttribute = this.config.addressNicknameAttribute;
    const region: MagentoResolvedRegion = extras.region ?? {
      region: { region: address.region },
    };
    // Magento validates `telephone` against the store's "Show Telephone"
    // setting; no placeholder is invented when no phone is known.
    const telephone = existing?.telephone || extras.telephone;

    return {
      ...(existing?.id !== undefined ? { id: existing.id } : {}),
      ...(nicknameAttribute
        ? {
            company: existing?.company,
            custom_attributes: [
              ...(existing?.custom_attributes ?? []).filter(
                (a) => a.attribute_code !== nicknameAttribute,
              ),
              { attribute_code: nicknameAttribute, value: nickName },
            ],
          }
        : {
            company: nickName,
            ...(existing?.custom_attributes
              ? { custom_attributes: existing.custom_attributes }
              : {}),
          }),
      firstname: address.firstName,
      lastname: address.lastName,
      street: [address.streetAddress, address.streetNumber],
      city: address.city,
      ...region,
      postcode: address.postalCode,
      country_id: address.countryCode,
      ...(telephone ? { telephone } : {}),
      default_billing: flags.default_billing ?? false,
      default_shipping: flags.default_shipping ?? false,
    };
  }

  /**
   * The predefined regions of a country, from the (store-view localised)
   * Magento directory. Cached, since the directory rarely changes.
   */
  protected async getCountryRegions(
    countryId: string,
  ): Promise<MagentoDirectoryRegion[]> {
    const storeView = resolveMagentoStoreViewCodeForContext(
      this.config.storeBaseCode,
      this.context,
    );
    const cacheKey = `magento:directory-country-regions:${storeView}:${countryId}`;
    const cached = await this.cache.get(cacheKey, CachedCountryRegionsSchema);
    if (cached) {
      return cached.regions;
    }

    const response = await this.magentoApi.storefrontRequest<unknown>(
      'GET',
      `/V1/directory/countries/${encodeURIComponent(countryId)}`,
    );
    const regions = MagentoDirectoryCountrySchema.parse(response).available_regions;

    await this.cache.put(
      cacheKey,
      { regions },
      {
        ttlSeconds: COUNTRY_REGIONS_TTL_SECONDS,
        dependencyIds: [`magento:directory-country:${countryId}`],
      },
    );
    return regions;
  }

  /**
   * Resolves the core address' free-text region (code or name) to Magento's
   * `region_id` when the country has predefined regions; otherwise the text
   * is sent as is.
   */
  protected async resolveRegion(
    address: Address,
  ): Promise<Result<MagentoResolvedRegion, NotFoundError>> {
    const text = address.region.trim();
    if (!text || !address.countryCode) {
      return success(text ? { region: { region: text } } : {});
    }

    let regions: MagentoDirectoryRegion[];
    try {
      regions = await this.getCountryRegions(address.countryCode);
    } catch (err) {
      if (isMagentoApiError(err) && err.status === 404) {
        return invalidInput(`Unknown country code "${address.countryCode}"`);
      }
      return handleMagentoProviderError('resolve address region', err);
    }

    if (regions.length === 0) {
      return success({ region: { region: text } });
    }

    const needle = text.toLowerCase();
    const match = regions.find(
      (r) =>
        r.code.toLowerCase() === needle ||
        r.name.toLowerCase() === needle ||
        r.id === text,
    );
    if (!match) {
      return invalidInput(
        `Unknown region "${text}" for country "${address.countryCode}"`,
      );
    }

    const regionId = Number(match.id);
    return success({
      region: { region: match.name, region_code: match.code, region_id: regionId },
      region_id: regionId,
    });
  }

  protected findByNickName(
    customer: MagentoCustomer,
    nickName: string,
  ): MagentoAddress | undefined {
    return (customer.addresses ?? []).find(
      (a) => this.getAddressNickname(a) === nickName,
    );
  }

  @Reactionary({
    inputSchema: ProfileQueryByIdSchema,
    outputSchema: ProfileSchema,
  })
  public async getById(
    payload: ProfileQueryById,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    const customer = await this.fetchCustomer(payload.identifier);
    if (!customer.success) {
      return customer;
    }
    return success(this.factory.parseProfile(this.context, customer.value));
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateSchema,
    outputSchema: ProfileSchema,
  })
  public async update(
    payload: ProfileMutationUpdate,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    const fetched = await this.fetchCustomer(payload.identifier);
    if (!fetched.success) {
      return fetched;
    }
    const customer = fetched.value;

    let addresses = this.preserveAddresses(customer);
    const phone = payload.phone.trim();
    if (phone && phone !== (this.getProfilePhone(customer) ?? '')) {
      const defaults = addresses.filter(
        (a) => a.default_billing || a.default_shipping,
      );
      if (defaults.length === 0) {
        return invalidInput(
          'Magento stores the phone number on the default billing or shipping address; add an address before setting a phone number',
        );
      }
      addresses = addresses.map((a) =>
        a.default_billing || a.default_shipping ? { ...a, telephone: phone } : a,
      );
    }

    return this.saveCustomer('update profile', payload.identifier, {
      ...customer,
      email: payload.email ?? customer.email,
      firstname: payload.firstName ?? customer.firstname,
      lastname: payload.lastName ?? customer.lastname,
      addresses,
    });
  }

  @Reactionary({
    inputSchema: ProfileMutationAddShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async addShippingAddress(
    payload: ProfileMutationAddShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    const fetched = await this.fetchCustomer(payload.identifier);
    if (!fetched.success) {
      return fetched;
    }
    const customer = fetched.value;

    if (this.findByNickName(customer, payload.address.identifier.nickName)) {
      return invalidInput('Address with the same nickname already exists');
    }

    const region = await this.resolveRegion(payload.address);
    if (!region.success) {
      return region;
    }

    const addresses = this.preserveAddresses(customer);
    addresses.push(
      this.buildMagentoAddress(payload.address, {}, undefined, {
        region: region.value,
        telephone: this.getProfilePhone(customer),
      }),
    );

    return this.saveCustomer('add shipping address', payload.identifier, {
      ...customer,
      addresses,
    });
  }

  @Reactionary({
    inputSchema: ProfileMutationUpdateShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async updateShippingAddress(
    payload: ProfileMutationUpdateShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    const fetched = await this.fetchCustomer(payload.identifier);
    if (!fetched.success) {
      return fetched;
    }
    const customer = fetched.value;

    const existing = this.findByNickName(
      customer,
      payload.address.identifier.nickName,
    );
    if (!existing) {
      return notFound(payload.address.identifier);
    }

    const region = await this.resolveRegion(payload.address);
    if (!region.success) {
      return region;
    }

    const isBilling = String(existing.id) === customer.default_billing;
    const isShipping = String(existing.id) === customer.default_shipping;

    const addresses = this.preserveAddresses(customer).map((a) =>
      a.id === existing.id
        ? this.buildMagentoAddress(
            payload.address,
            { default_billing: isBilling, default_shipping: isShipping },
            existing,
            { region: region.value, telephone: this.getProfilePhone(customer) },
          )
        : a,
    );

    return this.saveCustomer('update shipping address', payload.identifier, {
      ...customer,
      addresses,
    });
  }

  @Reactionary({
    inputSchema: ProfileMutationRemoveShippingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async removeShippingAddress(
    payload: ProfileMutationRemoveShippingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    const fetched = await this.fetchCustomer(payload.identifier);
    if (!fetched.success) {
      return fetched;
    }
    const customer = fetched.value;

    const existing = this.findByNickName(
      customer,
      payload.addressIdentifier.nickName,
    );
    if (!existing) {
      return notFound(payload.addressIdentifier);
    }

    const addresses = this.preserveAddresses(customer).filter(
      (a) => a.id !== existing.id,
    );

    return this.saveCustomer('remove shipping address', payload.identifier, {
      ...customer,
      addresses,
    });
  }

  @Reactionary({
    inputSchema: ProfileMutationMakeShippingAddressDefaultSchema,
    outputSchema: ProfileSchema,
  })
  public async makeShippingAddressDefault(
    payload: ProfileMutationMakeShippingAddressDefault,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    const fetched = await this.fetchCustomer(payload.identifier);
    if (!fetched.success) {
      return fetched;
    }
    const customer = fetched.value;

    const existing = this.findByNickName(
      customer,
      payload.addressIdentifier.nickName,
    );
    if (!existing) {
      return notFound(payload.addressIdentifier);
    }

    const addresses = this.preserveAddresses(customer).map((a) => ({
      ...a,
      default_shipping: a.id === existing.id,
    }));

    return this.saveCustomer('make shipping address default', payload.identifier, {
      ...customer,
      addresses,
    });
  }

  @Reactionary({
    inputSchema: ProfileMutationSetBillingAddressSchema,
    outputSchema: ProfileSchema,
  })
  public async setBillingAddress(
    payload: ProfileMutationSetBillingAddress,
  ): Promise<Result<ProfileFactoryOutput<TFactory>, NotFoundError>> {
    const fetched = await this.fetchCustomer(payload.identifier);
    if (!fetched.success) {
      return fetched;
    }
    const customer = fetched.value;

    const currentBilling = (customer.addresses ?? []).find(
      (a) => String(a.id) === customer.default_billing,
    );

    const collision = this.findByNickName(
      customer,
      payload.address.identifier.nickName,
    );
    if (collision && collision.id !== currentBilling?.id) {
      return invalidInput('Another address with the same nickname already exists');
    }

    const region = await this.resolveRegion(payload.address);
    if (!region.success) {
      return region;
    }
    const extras: MagentoAddressExtras = {
      region: region.value,
      telephone: this.getProfilePhone(customer),
    };

    let addresses = this.preserveAddresses(customer);
    if (currentBilling) {
      const isShipping = String(currentBilling.id) === customer.default_shipping;
      addresses = addresses.map((a) =>
        a.id === currentBilling.id
          ? this.buildMagentoAddress(
              payload.address,
              { default_billing: true, default_shipping: isShipping },
              currentBilling,
              extras,
            )
          : a,
      );
    } else {
      addresses.push(
        this.buildMagentoAddress(
          payload.address,
          { default_billing: true },
          undefined,
          extras,
        ),
      );
    }

    return this.saveCustomer('set billing address', payload.identifier, {
      ...customer,
      addresses,
    });
  }

  protected preserveAddresses(customer: MagentoCustomer): MagentoAddress[] {
    return (customer.addresses ?? []).map((a) => ({
      ...a,
      default_billing: String(a.id) === customer.default_billing,
      default_shipping: String(a.id) === customer.default_shipping,
    }));
  }
}
