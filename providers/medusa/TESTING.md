# Medusa Provider Testing

This document describes the testing setup for the Medusa provider.

## Test Setup

The Medusa provider uses [Vitest](https://vitest.dev/) for testing, which is already configured in the workspace.

### Configuration

- **Test runner**: Vitest
- **Configuration**: `vitest.config.ts`
- **Test files**: `src/**/*.spec.ts` and `src/**/*.test.ts`
- **Coverage**: HTML and text reports

### Running Tests

```bash
# Run all tests
npx nx test medusa

# Run tests in watch mode
npx nx test:watch medusa

# Run tests with UI
npx nx test:ui medusa

# Run tests with coverage
npx nx test medusa --coverage
```

### Test Structure

Tests are organized by component:

- `src/core/client.spec.ts` - Tests for MedusaClient
- `src/providers/cart.provider.spec.ts` - Tests for MedusaCartProvider

### Mocking

The tests use Vitest's built-in mocking capabilities:

- **Medusa SDK**: Mocked using `vi.mock('@medusajs/js-sdk')`
- **Debug**: Mocked using `vi.mock('debug')`
- **External dependencies**: Mocked as needed

### Coverage

Coverage reports are generated in the `../../coverage/providers/medusa` directory and include:

- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

HTML reports can be viewed by opening `coverage/index.html` in a browser.

## Writing Tests

### Example Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MyClass } from './my-class.js';

// Mock external dependencies
vi.mock('external-library', () => ({
  default: vi.fn(),
}));

describe('MyClass', () => {
  let instance: MyClass;

  beforeEach(() => {
    instance = new MyClass();
  });

  describe('method', () => {
    it('should do something', () => {
      const result = instance.method();
      expect(result).toBe(expected);
    });
  });
});
```

### Best Practices

1. **Use descriptive test names** that explain what the test does
2. **Group related tests** using `describe` blocks
3. **Mock external dependencies** to keep tests isolated
4. **Test both success and error cases**
5. **Use beforeEach** for common setup
6. **Assert on behavior**, not implementation details

## Continuous Integration

Tests are automatically run as part of the CI/CD pipeline and must pass before code can be merged.
