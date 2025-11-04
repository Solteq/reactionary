# Getting started

You can use Reactionary on any node-based project. It can be a NextJS BFF, or a commandline utility meant to create product-feeds for Google or OpenAI, or technically, in a ReactNative, or NativeScript application on your iPhone/Android app.

In these examples i use `pnpm`, but you can use `yarn` or `npm` as you see fit.

We assume you have a project ready, already...

## Vendors
For this example we assume you are using Commercetools as the ecom capability, and Algolia as the search provider. Both have free trial options, that can get you started.
So, go ahead and set up new free trials for both of those, and generate API Clients and tokens for both. For Commercetools, you can use the "Storefront" preset.



## Installing packages

For our example we need to install providers for Commercetools and Algolia both.

`pnpm install @reactionary/core @reactionary/provider-algolia @reactionary/provider-commercetools`

We will also prepare for open telemetry reporting to NewRelic (also offers free trial, so go ahead and set that up)

`pnpm install @reactionary/otel`



## Bootstrapping the client

You use the `ClientBuilder` from `@reactionary/core` to create a new client, and then specify which capabilties you need. Only the capabilties you mention will be prepared for you.

```ts
  const client = new ClientBuilder()
    .withCapability(
      withCommercetoolsCapabilities(getCommercetoolsConfig(), 
      {
        product: true,
        cart: true,
        order: true
      }
    )
    .withCapability(
      withAlgoliaCapabilities(getAlgoliaConfig(), {
        productSearch: true
      })
    )
    .withCache(new NoOpCache())
    .build();

  ```



  with `getCommercetoolsConfig` being a function like

  ```ts
  export function getCommercetoolsTestConfiguration() {
  return CommercetoolsConfigurationSchema.parse({
        apiUrl: process.env['CTP_API_URL'] || '',
        authUrl: process.env['CTP_AUTH_URL'] || '',
        clientId: process.env['CTP_CLIENT_ID'] || '',
        clientSecret: process.env['CTP_CLIENT_SECRET'] || '',
        projectKey: process.env['CTP_PROJECT_KEY'] || '',
        scopes: (process.env['CTP_SCOPES'] || '').split(',').map(x => x.trim()).filter(x => x && x.length > 0),

        paymentMethods: [
          PaymentMethodSchema.parse({
            identifier: PaymentMethodIdentifierSchema.parse({
              paymentProvider: 'stripe',
              method: 'stripe',
              name: 'Stripe',
            }),
            description: 'Stripe payment gateway'
          })
        ]
    })
}

```

and `getAlgoliaConfig` being something like

```ts
 export function getCommercetoolsTestConfiguration() {
  return AlgoliaConfigurationSchema.parse({
      apiKey: process.env['ALGOLIA_API_KEY'] || '',
      appId: process.env['ALGOLIA_APP_ID'] || '',
      indexName: process.env['ALGOLIA_INDEX'] || '',
    })
}
```

and, then ofc, you need to provide all those values, in, say, a `.env` file (that you will not be adding to git)


### Establishing state
Before we can start calling vendors, we need to set up the context in which the requests will take place. This is information that is describing who the customer is,  what session data he has, some information about the current request, and so forth. All calls processed during the processing of one request from the frontend, share the same request data, so usually this can be established in some middleware function of your api-server.


```ts
// we have to create a request context with all the information the underlying layer might need. 
// We are responsible for the session object, and persisting it between requests.
// This would normally be in a middleware
const requestContext = createInitialRequestContext();

// set any locale settings from route or browser (or set it fixed,if there is only one language)
requestContext.languageContext = LanguageContextSchema.parse({
  locale: 'en-US',
  currency: 'USD'
});

// re-establish session info from last call

const mySession = getSessionDataFromServer();

if (!mySession.reactionarySessionData) {
  mySession.reactionarySessionData = {};
}
if (!mySession.reactionaryIdentity) {
  mySession.reactionaryIdentity =  IdentitySchema.parse({});
}

requestContext.identity =  mySession.reactionaryIdentity;
requestContext.session =  mySession.reactionarySessionData;



// set request specific info
requestContext.correlationId = 'my-frontend-' + GUID.newGuid();
requestContext.clientIp = request.headers['REMOTE_CLIENT_IP'] || request.headers['X_REMOTE_CLIENT_IP'] || '';
requestContext.userAgent = request.headers['USER_AGENT'] || 'none';
requestContext.isBot = userAgent.match('/bot/gi');

request.reactionaryRequestContext = requestContext;
```

Then in your page/component/context 

```ts
const me = await client.identity.get(request.reactionaryRequestContext);
if (me.type === 'REGISTERED_CUSTOMER') {
  // do something only for registered customers...
}
```

### Making calls to get data
Let us assume the page we are rendering wants to include some minicart information. Given the client we created above, you can now call

```ts
let cartId = await client.cart.getActiveCartId();
if (!cartId) {
  cartId = '';
}
const cart = await client.cart.getById(cartId);
const totalSum = cart.price.grandTotal.value;
```





