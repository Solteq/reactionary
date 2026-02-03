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



## Errors as values
We have decided to adopt the Errors-as-values paradigm seen in other server-side APIs, to encourage that all state returned, is inspected for error state, rather than simply allowing an unexpected thrown exception to alter the flow of things.

This means generally, that calls follow this structure:

```
const cartResponse = await this.client.cart.getById({...});
if (cartResponse.success) {
  console.log('my cart is', cartResponse.value)
}

if (!cartResponse.success) {
  console.log('Cart was not loadable due to ', cartResponse.error);
}
```

This might seem verbose, over simply assuming the value is set when it gets back, but it encourages handling minor problems immediately, rather than starting out developing only the happy-path, and then promising yourself to circle back and deal with errors later.


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

The expected lifecycle of a client created here, is for the duration of this single request. 

```ts
// we have to create a request context with all the information the underlying layer might need. 
// We are responsible for the session object, and persisting it between requests.
// This would normally be in a middleware

// getSession here is a utility function from the frontend framework (nextjs,react-router,whatever) that stores your
// users session data between calls. 
  const session = await getSession(
    request.headers.get("Cookie")
  );

  // from this we create a requestContext
  
  const reqCtx = createInitialRequestContext();

  // optionally, set any locale settings from route or browser (or set it fixed,if there is only one language). 
  reqCtx.languageContext = LanguageContextSchema.parse({
    locale: 'en-US',
    currency: 'USD'
  });

  reqCtx.session = JSON.parse(session.get('reactionarySession') || '{}');

  // the reactionarySession object contains all the session data that reactionary controls.
  // if it isn't there (new session? ) we create it
  if (!session.has('reactionarySession')) {
    session.set('reactionarySession', JSON.stringify({}));
  }
  
  // we capture some information from the request, like some interesting headers and optional correlation ids sent from the frontend for
  // traceability
  reqCtx.clientIp = request.headers.get('X-Forwarded-For') || request.headers.get('Remote-Addr') || '';
  reqCtx.userAgent = request.headers.get('User-Agent') || '';
  reqCtx.isBot = /bot|crawler|spider|crawling/i.test(reqCtx.userAgent || '');
  reqCtx.referrer = request.headers.get('Referer') || '';
  reqCtx.correlationId = request.headers.get('X-Correlation-ID') || 'remix-' + Math.random().toString(36).substring(2, 15);

  // we now have all we need to set up a client, so we pass the request context to the client builder.
  // inlined here for clarity. Usually you would put this in a utility function called something like createClient
  const client = new ClientBuilder(reqCtx)
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

Then in your page/component/context 

```ts
const meResponse = await client.identity.getSelf({});
if (meResponse.success) {
  if (meResponse.value.type === 'Registered') {
    // do something only for registered customers...
  }
}
```

### Making calls to get data
Let us assume the page we are rendering wants to include some minicart information. Given the client we created above, you can now call

```ts
// first, check if we have a cart id registered on the session
let cartId = mySession.activeCartId;

// if not, lets see if the system might have it for us
if (!cartId) {
  cartIdResponse = await client.cart.getActiveCartId();
  if (cartIdResponse.success) {
    cartId = cartIdResponse.value;
  } else {
    // we dont really care why it couldn't load.  We just reset to a safe value
    cartId = '';
  }
  
}

// no? then lets just zero it out, and start over.
if (!cartId) {
  cartId = '';
}
const cartResponse = await client.cart.getById(cartId);

let totalSum = 0;
if (cartResponse.success) {
  // store it for future reference
  mySession.activeCartId = cartResponse.value.identifier.key;
  totalSum = cartResponse.value.price.grandTotal.value;
} 

```




## Design decisions
We want Reactionary to be as unintrusive to the frontend frameworks best practice for state management. So we do not try to offer too many convenience methods that might slow down the site unnecessarily.

This is why we don't offer a `cart.getActiveCart()`, because in some situations identifying the active cart id, might require an extra call for each operation.


