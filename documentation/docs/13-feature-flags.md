# Feature flags

Reactionary comes with support for dynamically reading featureflags for your session.

This means, when you make significant changes to your codebase, you can define a feature flag in some external system (PostHog, Azure App Config, LaunchDarkly), and only present your change to X% of the user base over a period of time.

Ideally, you will then have some automation to turn things back off, if it turns out the change was detrimental.


## Load all flags on startup
As your flags can be dependent on cohort, reactionary couples these to your marketing profile.

So, at some point after session initialization, you should be able to do something like
```ts
const featureFlagsResponse = client.featureFlag.getFlags({ personalizationProfile: mypersonalizationProfile });
if (featureFlagsResponse.success) {
  const flags = featureFlagsResponse.value;
  session.flags = flags;
} else {
  session.flags = [];
}
```


then later, in your component, you can then do
```ts
let useOnePageCheckout = client.featureFlags.isEnabled(session.flags, 'onePageCheckout');
```


There is a second form of feature flag, which is multivariate flags, this is something where you get a string back instead.
```ts
let ctaColor = 'red';
if (client.featureFlags.isEnabled(session.flags, 'CTAColor', 'blue')) {
  ctaColor = 'blue'; 
} else if client.featureFlags.isEnabled(session.flags, 'CTAColor', 'green') {
  ctaColor = 'green'
}
```

Reactionary does not cache this information, because some usage patterns make it unclear when it can be refreshed. 



## Fake
The fake version of this provider, takes as configuration a list of feature flags. You can use this to dynamically switch between states, either as DX or build it into a preview system.
