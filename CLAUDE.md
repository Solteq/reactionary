# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Build Commands
```bash
# Build all projects
npx nx run-many -t build

# Build specific project
npx nx build core
npx nx build provider-commercetools
npx nx build examples-angular

# Build with dependencies
npx nx build core --with-deps
```

### Development Servers
```bash
# Angular example
npx nx serve examples-angular

# Vue example  
npx nx serve examples-vue

# Node.js/tRPC examples
npx nx serve examples-node
npx nx serve trpc-node
```

### Testing
```bash
# Run all tests
npx nx run-many -t test

# Run tests for specific project
npx nx test core
npx nx test provider-commercetools

# Run tests in watch mode
npx nx test core --watch

# Run E2E tests
npx nx e2e examples-angular
```

### Code Quality
```bash
# Lint all projects
npx nx run-many -t lint

# Lint specific project
npx nx lint core

# Type checking (for Vue projects)
npx nx typecheck examples-vue
```

### Release & Publishing
```bash
# Version and release
npx nx release

# Publish to npm
npx nx run-many -t nx-release-publish
```

## Architecture Overview

Reactionary is a **framework-agnostic e-commerce client library** that prioritizes server-side operations to minimize client bundles and enable cross-transactional caching.

### Core Design Principles
- **Server-Side First**: Providers remain on the server for security, caching, and observability
- **Framework Agnostic**: Core library works with Angular, React/Next.js, Vue.js
- **Type Safety**: Zod schemas for runtime validation, tRPC for end-to-end type safety
- **Provider Pattern**: Pluggable architecture for different service integrations

### Project Structure

**Monorepo Layout:**
- `/core/` - Core framework library with base providers, models, schemas
- `/providers/` - Service integrations (CommerceTools, Algolia, PostHog, Fake)
- `/examples/` - Framework implementations (Angular, Vue, Node.js, tRPC)
- `/trpc/` - tRPC router utilities
- `/dist/` - Build outputs

### Key Architectural Components

**Provider System:**
All providers extend `BaseProvider` and implement business capabilities:
- `ProductProvider` - Product catalog operations
- `SearchProvider` - Search functionality  
- `CartProvider` - Shopping cart management
- `IdentityProvider` - User authentication/sessions
- `PriceProvider` - Pricing operations
- `InventoryProvider` - Stock management
- `AnalyticsProvider` - User behavior tracking

**Client Composition:**
```typescript
interface Client {
  product: ProductProvider
  search: SearchProvider
  identity: IdentityProvider
  cart: CartProvider
  analytics: Array<AnalyticsProvider>
  price: PriceProvider
  inventory: InventoryProvider
  cache: Cache
}
```

**Domain Models:**
All models use Zod schemas located in `/core/src/schemas/models/`:
- Product, Cart, Identity, Search, Price, Inventory models
- Common models in `/core/src/schemas/models/common/`
- Query/Mutation schemas follow CQRS pattern

**Session Management:**
Providers are session-aware - operations receive `Session` context for user-specific data.

### Module Export Structure

The core library (`/core/src/index.ts`) exports 44 modules organized by:
- Providers (base and specific implementations)
- Models (domain entities)
- Queries and Mutations (CQRS operations)
- Cache implementations (Redis/Upstash)
- Client builder utilities

### Technology Stack
- **TypeScript** 5.8.3 (ES2015 target)
- **Zod** 4.0.0-beta for schema validation
- **tRPC** 11.1.2 for type-safe APIs
- **Nx** 21.3.11 for monorepo management
- **esbuild** for library compilation (ESM format)
- **Jest** for testing
- **pnpm** 8.15.9 as package manager

## Development Workflow

### Environment Setup
Examples require `.env` files with API keys for provider services.

### Git Workflow
- Branch from `main` for new features
- Preserve linear history (rebase, not merge)
- Follow conventional commit messages
- Link PRs to issues

### Current Development Context
The repository is currently on branch `feature/productModel` with significant model refactoring in progress, including updates to product models, common model reorganization, and provider interfaces.

## Key Terms
- **Provider**: Backend service API (e.g., CommerceTools, Algolia)
- **Capability**: Business functionality area (e.g., Cart, Product)
- **Gateway**: Server process encapsulating capabilities
- **Client**: Client-side facade to the gateway
- **Fake**: Limited implementation for prototyping/testing