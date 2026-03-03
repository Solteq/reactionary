# Architecture
The following will, at some point, be an attempt at explaining the architecture of reactionary - both for the purposes of people wanting to extend or add capabilities here, and for the purposes of adding it in project specific overrides.

## Glossary
- Capability: a single business domain that may be utilized by the consumer. Examples: Cart, Product, Category, ProductSearch.
- Capability Procedure: a single piece of exposed functionality within a business domain. Examples: Cart.addItem, Cart.removeItem, Product.getBySlug
- Provider: a single remote system providing a set of functionality. A provider may provide anywhere from a single capability to all the capabilities.
- Schema: the source of truth for input and output types. These need to provide both compile-time types, as well as runtime parsing / validation.
- Definition: the internal part of a capability or procedure, that is to say the definition of it BEFORE being converted to a client.
- Client: the final interface exposing the sum of business capabilities to the consumer.
- Global middleware: functionality that needs to run on all requests performed, across capabilities and providers, such as Telemetry or Caching.
- Contract: the minimum set of functionality expected to be exposed by providers of a given capability - both in terms of procedures, and the input / output for those procedures.

## Architectural requirement list

### OOTB-001: It should be easy to bootstrap a client

### OOTB-002: It should be easy to configure providers

### OOTB-003: It should be easy to mix providers

### OOTB-004: It should be easy to see the functionality available on the client

### OOTB-005: It should be easy to trust the functionality on the client, even at runtime

### CUST-001: It should be easy to adapt extending output models

### CUST-002: It should be easy to adapt the input of existing procedures

### CUST-003: It should be easy to adapt the logic of existing procedures

### CUST-004: It should be easy to add new procedures to an existing capability

### CUST-005: It should be easy to add new capabilities

### AMS-001: It should be possible to get good information on errors in remote systems

### AMS-002: It should be possible to get good metrics to monitor system use in remote systems

### PERF-001: It should be possible to cache queries for throughput