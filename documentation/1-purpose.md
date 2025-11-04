# Reactionary

Reactionary is an oppinionated abstraction layer between UX developer and Backend developer in a Composable Commerce environment.

In a composable commerce project, you will have a bag of services that together provide all the functionality you need on the site.
And over time, you will probably decide to move from one such service, to another, if you want to, say, have better search, or better recommendations.

Reactionary creates a vendor agnostic domain model, and set of providers towards those vendors, that will allow UX developers to focus on their own craft, rather than both having to learn NextJS/Nuxt/Svelte/Htmx, in addition to the 4-6 vendor apis that go into the site.

To coin a term, we talk about a UX developer needing access to certain capabiltiies.

These can be things like
1. Cart
1. Proile
1. Product Data
1. Product Search
1. Order History

Reactionary is intended to live on the server side of your frontend. It uses the publically available clients for known and services, and is not trying to optimize for backend bundle size. Instead, we try to optimize for developer speed.


## Audience
This document is for UX developers who need to know abit about how reactionary works, and how the expected usage pattern should be. 
It is also for Backend developers, who need to customize the providers and domain models, to match the specific domain of your site.

## Goal

The goal is 
- To support any Node based frontend framework (NextJS, Rapi, Angular Universal, etc)
- To provide the capabilities needed to build both B2C and B2B sites
- To make it easy and natural to specialize/customize both the domain model, and provider
- To provide cross transactional caching and cache management
- To provide open telemetry data for proper monitoring and fault detection

## Design criteria
Reactionary will be a stateless framework. It will not keep or maintain any state between calls.
The UX framework used for the presentation layer is responsible for storing and retrieving any session data that reactionary needs to operate. 

This also means, reactionary does not do any client-state or UI-state management at all. In the Service => Provider => Factory setting, reactionary is the Provider and Factory layer.

Each capability will have certain behavioral criteria that the UX designer can rely on. This means, occasioanlly there will be mandatory backend customizations required if a vendors product does not fully fit.

Where this is noted, a reference implementation will be made available.

Runtime is targeting modern ESM/ES6 systems.

We strive to avoid unbounded requests. This means, we don't generally allow for nested lists of things of indeterminate size. Instead a paged getter will be available to fetch a page of sub-items.



## FAQ

### What do you mean by capability?
Consider the product search of a regular/standard ecommerce site. It has a text field. When you type in it, it fetches a list of products, and a list of facets, each with a count. User can page the result list (directly, or virtually through endless scroll) , and maybe choose to sort. 

This basic capabilitys UX journey can be tweaked and designed for mobile, and foldable, and ipads, and desktop, and once visually there, this is not likely to change.
However, there is significant difference in how this would be done using Commercetools' product search, Algolias search, Klevu (now Athos Commerce), Constructor.io or Doofinder.

By creating a unifying domain model you can have your UX work for any of the mentioned vendors without changing anything, aside from the configuration of which vendor to use.

### But couldn't i just to that myself? In react i could just have a useHook and hide all the things in there?
Sure, and on your next project you could do it again.... and on the next one, again, only here you had a different team, so its slightly different.. and so on. And the 4th project uses Svelte, so the hooks from earlier need to be rewritten. 

Reactionary is targeting being that abstraction, so you can have consistent behavior between projects and between teams.

### Why would you use this, over, say, just using the graphql endpoint of your ecommerce 
In a composable commerce project, the ecommerce system is no longer automatically the master system. You might have a DXE strategy, or you might have any number of other systems involved. By using a bridge framework like reactionary, you break the vendor lock, and can later pick a new ecommerce platform, where the performance is better, and the promotions more closely match your requirements, without having to redo the entire frontend project.

### Why dont i just create my own graphql server then, and aggregate all the vendors i use?
GraphQL servers are hard to get right, when you consider security, performance, caching et al. 
GraphQL is great, if your site is a client-side rendered application, that needs to run on the smallest of bandwidth, and you have the time to artisinally craft the perfect payload for each call. But as SSR and Partial SSR is becoming the new norm, and the precense of a BFF is now part of the equation in most commercial projects, you do not gain anything significant from having your backend save 40 bytes from fetching product data on your own graphql server right next to it.
The BFF->Client protocol is typically page related, or feature related. Not a straight API forwarding.

### My DXE/CMS allows merging/exposing other endpoints via their GraphQL, isnt that the same then?
Even if you disregard that the DXE still has to fetch the data from your vendor, and this means somehow propagating some authentication information to the CMS, the exposed API is still the original API, meaning your frontend developers still need to learn Algolia vs Klevu vs Doofinder.

### What do you mean about specializing the domain model?
Consider a product with a descriptive set of attributes for "StorageRequirementCode" .
It is used visually on the PDP to show the value of that attribute, but there is a special requirement that if a product iand requires cooling, it cannot be added to the cart, unless you have a special permit, or maybe it means you can't choose pickup-in-store,  and also it must be flagged on every page the product is shown, to alert the end customer that he needs to be aware of this.

As attributes are optional, and multivalued, this means you end up with something like this:
```
  public requireRefrigeration = computed(() => {
    const code = this.product()?.descriptiveAttributes?.find(
      (attr) => attr.identifier === 'StorageRequirementCode'
    );
    return !!(
      code &&
      code.values &&
      code.values.length > 0 &&
      code.values[0].value === 'KØL'
    );
  });
``` 
if you are  lucky, or inlined directly in the `tsx` or `.html` of the component in every place this is used.

This gets even worse, if you consider you might also have commandline utilities that pull out products for sitemap generation, or other things.

Instead of doing this distributed all over the place, where things will break down once it turns out that they need to add an additional StorageRequirementCode to the check, these kinds of manifestations of the products domain should be moved onto the product itself.

Ie, extend the schema with `requireRefrigeration` as a field on the product, with the logic applied centrally where the data is loaded, rather than where it is used. That way, all instances where this is accessed, looks like `product.requireRefrigiration` instead of the other thing, which makes the code infinetly more readable and maintainable, since your reactionary customizations are reused and shared between applications.



