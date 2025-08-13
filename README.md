# Reactionary

A type-safe, framework-agnostic e-commerce abstraction layer that unifies multiple commerce platforms, search providers, and analytics services behind a single, consistent API.

## What is Reactionary?

Reactionary simplifies building modern e-commerce applications by providing:

- **Unified API** across different e-commerce platforms (CommerceTools, etc.)
- **Framework flexibility** - works with Angular, React/Next.js, and Vue.js
- **Type safety** from server to client using TypeScript, Zod, and tRPC
- **Optimized performance** through server-side provider management and intelligent caching
- **Pluggable architecture** for easy provider switching without code changes

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8.15.9+
- API keys for your chosen providers (stored in `.env` files)

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
npx nx run-many -t build

# Run an example application
npx nx serve examples-angular
```

## Architecture Philosophy

Reactionary takes an opinionated approach to e-commerce architecture:

### Server-Side First
Providers stay on the server to:
- Minimize client bundle sizes for better performance
- Enable cross-transactional caching
- Standardize observability and monitoring
- Control access with features like rate limiting

### Domain-Driven Design
Clear separation of business capabilities:
- **Product** - Catalog management
- **Cart** - Shopping cart operations
- **Search** - Product discovery
- **Identity** - User authentication and sessions
- **Price** - Pricing calculations
- **Inventory** - Stock management
- **Analytics** - User behavior tracking

## Project Structure

```
reactionary/
├── core/               # Core library with base providers and models
├── providers/          # Service integrations
│   ├── algolia/       # Search provider
│   ├── commercetools/ # E-commerce platform
│   ├── posthog/       # Analytics provider
│   └── fake/          # Mock provider for testing
├── examples/          # Framework implementations
│   ├── angular/       # Angular example
│   ├── vue/          # Vue.js example
│   └── node/         # Node.js/Express examples
└── trpc/             # tRPC router utilities
```

## Development

### Common Commands

```bash
# Build
npx nx build core                    # Build specific package
npx nx run-many -t build             # Build all packages

# Test
npx nx test core                     # Run tests for specific package
npx nx test core --watch            # Run tests in watch mode
npx nx run-many -t test             # Run all tests

# Lint
npx nx lint core                    # Lint specific package
npx nx run-many -t lint             # Lint all packages

# Serve Examples
npx nx serve examples-angular       # Run Angular example
npx nx serve examples-vue           # Run Vue example
```

### Environment Configuration

Each example application requires environment variables for provider API keys. Create a `.env` file in the example directory:

```env
COMMERCETOOLS_PROJECT_KEY=your-project-key
COMMERCETOOLS_CLIENT_ID=your-client-id
COMMERCETOOLS_CLIENT_SECRET=your-client-secret
ALGOLIA_APP_ID=your-app-id
ALGOLIA_API_KEY=your-api-key
```

## Contributing

### Development Workflow

1. **Branch from `main`** for new features
2. **Preserve linear history** - rebase instead of merge
3. **Follow conventional commits** for commit messages
4. **Link PRs to issues** for tracking

### Pull Request Guidelines

- Ensure all tests pass
- Update documentation as needed
- Keep commits focused and atomic
- Write clear, descriptive commit messages

Example commit message:
```
feat(cart): add support for discount codes

Implements discount code validation and application
during checkout process
```

## Glossary

### Core Concepts

- **Provider**: A backend service integration that implements specific business capabilities. Examples include CommerceTools for e-commerce operations, Algolia for search, or PostHog for analytics.

- **Capability**: A discrete area of business functionality exposed through a provider. For example, the Cart capability includes operations like adding items, removing items, and calculating totals.

- **Gateway**: A server-side process that encapsulates multiple capabilities and handles provider configuration. This could be a tRPC router, Next.js API routes, or an Express server. The gateway ensures sensitive configuration stays server-side.

- **Client**: The type-safe facade that applications use to interact with the gateway. In tRPC, this is the tRPC client with full type inference from the server.

- **Session**: User-specific context passed to providers for operations. Contains authentication state, user preferences, and other contextual data needed for personalization.

### Technical Terms

- **Observability**: System monitoring in production environments using OpenTelemetry (OTEL) for traces and metrics. Distinct from analytics which tracks user behavior.

- **Fake Provider**: A functional but limited implementation used for development and testing. For example, a fake cart provider might store data in-memory rather than a real database.

- **Product Analytics**: Structured data about how users interact with the product (clicks, conversions, etc.), as opposed to system observability.

- **Microsite**: A focused application demonstrating specific functionality, useful for prototypes or isolated feature development.

- **Domain Model**: Type-safe data structures validated by Zod schemas that represent business entities (Product, Cart, User, etc.).

- **CQRS Pattern**: Command Query Responsibility Segregation - separate schemas for read operations (queries) and write operations (mutations).

## License

MIT

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/your-org/reactionary/issues).