# Tracking customer interactions
Reactionary takes the approach that tracking customer data should be structured and managed, as opposed to ad-hoc in the browser. The core implication of this is that tracking should happen as a centralized, first-party stream of data to the backend, which may then in turn delegate it to the interested parties. We take this approach for a few reasons:

- Performance: the client should not have to load several megabytes of tracking scripts that may in turn bring in other tracking scripts as their first priority upon entering the site. This is treating the customer a product rather than a valued customer. The client should only send their tracking data ONCE, and the performance impact of having to collect it should be a minimal obstruction to their actual goal.
- Control: the system should enforce mandatory requirements such as Do Not Track in a single place, and ensure that anonymization happens as required.
- Structure: it should be possible to reason about what is tracked on the site, how it is tracked and when it is tracked without having to visit seven different tag managers.
- Security: pulling in all the embedded and inline scripts from every tag manager is a security incident waiting to happen.

To this end the client exposes a single provider in the form of `client.analytics`. This client is internally responsible for delegating events to all relevant subscribers capabilities used to build the client. This means that a single call to record a pageview or attribution will be enough, even if that data internally needs to be multiplexed to GA4, Algolia and Posthog as an example.
