import {
    type Identity,
    type IdentityMutationLogin,
    type IdentityMutationLogout,
    type IdentityMutationRegister,
    type IdentityQuerySelf,
    type RequestContext,
    type Cache,
    IdentityProvider,
    Reactionary,
    IdentityQuerySelfSchema,
    IdentitySchema,
    IdentityMutationRegisterSchema,
    IdentityMutationLoginSchema,
    IdentityMutationLogoutSchema,
    type AnonymousIdentity,
    type RegisteredIdentity,
    type Result,
    success,
} from '@reactionary/core';
import type { MagentoClient } from '../core/client.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:magento:identity');

export class MagentoIdentityProvider extends IdentityProvider {
    protected config: MagentoConfiguration;

    constructor(
        config: MagentoConfiguration,
        cache: Cache,
        context: RequestContext,
        public magentoApi: MagentoClient
    ) {
        super(cache, context);
        this.config = config;
    }

    protected createAnonymousIdentity(): AnonymousIdentity {
        return {
            type: 'Anonymous',
        };
    }

    @Reactionary({
        inputSchema: IdentityQuerySelfSchema,
        outputSchema: IdentitySchema,
    })
    public override async getSelf(
        _payload: IdentityQuerySelf
    ): Promise<Result<Identity>> {
        try {
            const client = await this.magentoApi.getClient();
            const me = await client.store.customer.me();

            const identity = {
                id: {
                    userId: String(me.id),
                },
                type: 'Registered',
            } satisfies RegisteredIdentity;

            this.updateIdentityContext(identity);
            return success(identity);
        } catch (error) {
            debug('getSelf failed, returning anonymous identity:', error);
            const identity = this.createAnonymousIdentity();
            this.updateIdentityContext(identity);
            return success(identity);
        }
    }

    @Reactionary({
        inputSchema: IdentityMutationLoginSchema,
        outputSchema: IdentitySchema,
    })
    public override async login(
        payload: IdentityMutationLogin
    ): Promise<Result<Identity>> {
        debug('Attempting login for user:', payload.username);
        await this.magentoApi.login(payload.username, payload.password);

        return this.getSelf({});
    }

    @Reactionary({
        inputSchema: IdentityMutationLogoutSchema,
        outputSchema: IdentitySchema,
    })
    public override async logout(
        _payload: IdentityMutationLogout
    ): Promise<Result<Identity>> {
        debug('Logging out user');
        await this.magentoApi.logout();

        const identity = this.createAnonymousIdentity();
        this.updateIdentityContext(identity);
        return success(identity);
    }

    @Reactionary({
        inputSchema: IdentityMutationRegisterSchema,
        outputSchema: IdentitySchema,
    })
    public override async register(
        payload: IdentityMutationRegister
    ): Promise<Result<Identity>> {
        debug('Registering new user:', payload.username);


        const customer = {
            email: payload.username,
            firstname: (payload as any).firstname || 'User',
            lastname: (payload as any).lastname || 'Account',
        };

        await this.magentoApi.register(customer, payload.password);

        return this.login({
            username: payload.username,
            password: payload.password
        });
    }
}
