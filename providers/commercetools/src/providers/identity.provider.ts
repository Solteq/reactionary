import { Identity, IdentityLoginPayload, IdentityProvider, Session } from "@reactionary/core";
import { CommercetoolsConfiguration } from "../schema/configuration.schema";
import z from "zod";
import { CommercetoolsClient } from "../core/client";

export class CommercetoolsIdentityProvider<Q extends Identity> extends IdentityProvider<Q> {
    protected config: CommercetoolsConfiguration;
  
    constructor(config: CommercetoolsConfiguration, schema: z.ZodType<Q>) {
      super(schema);
  
      this.config = config;
    }

    public override async get(session: Session): Promise<Q> {
        const client = new CommercetoolsClient(this.config);
        const base = this.base();

        if (session.identity.token) {
            const remote = await client.introspect(session.identity.token);

            if (remote.active) {
                const current = this.schema.safeParse(session.identity);

                if (current.success) {
                    return this.validate(session.identity);
                }
            }
        }

        session.identity = base;

        return base;
    }

    public override async login(payload: IdentityLoginPayload, session: Session): Promise<Q> {
        const client = new CommercetoolsClient(this.config);
        const remote = await client.login(payload.username, payload.password);
        const base = this.base();

        if (remote && remote.access_token) {
            base.issued = new Date();
            base.expiry = new Date();
            base.expiry.setSeconds(base.expiry.getSeconds() + remote.expires_in);
            base.id = this.extractCustomerIdFromScopes(remote.scope);
            base.token = remote.access_token;
            base.type = "Registered";
        }

        // TODO: error handling

        session.identity = base;

        return base;
    }

    public override async logout(session: Session): Promise<Q> {
        const client = new CommercetoolsClient(this.config);
        const base = this.base();

        if (session.identity.token) {
            const remote = await client.logout(session.identity.token);

            // TODO: error handling
        }

        session.identity = base;
        

        return base;
    }

    protected extractCustomerIdFromScopes(scopes: string) {
        const scopeList = scopes.split(' ');
        const customerScope = scopeList.find(x => x.startsWith('customer_id'));
        const id = customerScope?.split(':')[1];

        return id || '';
    }
}
