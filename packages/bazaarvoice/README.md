# @reactionary/bazaarvoice

Bazaarvoice Conversations REST API v5 adapter for `@reactionary/core`.

Implements `ProductReviewsCapability` — ratings summaries, paginated review lists, and review submission — by calling the Bazaarvoice Conversations REST API directly using passKey authentication.

## Usage

```typescript
import { withBazaarvoiceCapabilities } from '@reactionary/bazaarvoice';

const getCapabilities = withBazaarvoiceCapabilities(
  {
    passKey: process.env.BV_PASS_KEY!,
    // apiUrl: 'https://api.bazaarvoice.com',  // production (default)
    // apiUrl: 'https://stg.api.bazaarvoice.com', // staging
  },
  {
    productReviews: { enabled: true },
  },
);

// In a request handler:
const capabilities = getCapabilities(cache, requestContext);
const summary = await capabilities.productReviews.getRatingSummary({ product: { key: 'MY-PRODUCT-001' } });
```

## Configuration

| Field        | Type     | Default                       | Description                                         |
| ------------ | -------- | ----------------------------- | --------------------------------------------------- |
| `passKey`    | `string` | required                      | Bazaarvoice API passkey                             |
| `apiUrl`     | `string` | `https://api.bazaarvoice.com` | Base API URL; use staging URL for test environments |
| `apiVersion` | `string` | `5.4`                         | Conversations API version                           |
| `locale`     | `string` | `en_US`                       | BCP47-style locale passed to BV API                 |

## Notes

- **Passkey scope**: Bazaarvoice may issue separate read and write passkeys. Ensure the passkey configured is write-enabled if `submitReview` is used.
- **Product ID alignment**: The `product.key` in queries must match the Bazaarvoice product ID (typically the same as the HCL `partNumber`).
- **Review moderation**: Submitted reviews enter the Bazaarvoice moderation queue and will not be immediately visible.
