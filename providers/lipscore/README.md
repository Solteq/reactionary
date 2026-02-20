# @reactionary/lipscore

Lipscore provider for Reactionary. This provider implements product reviews and ratings functionality using the Lipscore API.

## Capabilities

- `productReviews`: Product reviews and ratings

## Installation

```bash
npm install @reactionary/lipscore
```

## Usage

```typescript
import { withLipscoreCapabilities } from '@reactionary/lipscore';
import { createClient } from '@reactionary/core';

const client = createClient(
  withLipscoreCapabilities(
    {
      apiKey: 'your-lipscore-api-key',
      siteId: 'your-site-id',
    },
    {
      productReviews: true,
    }
  )
);

// Get rating summary
const ratingSummary = await client.productReviews.getRatingSummary({
  product: { key: 'product-123' },
});

// List reviews
const reviews = await client.productReviews.listReviews({
  product: { key: 'product-123' },
  paginationOptions: { pageNumber: 1, pageSize: 10 },
});

// Submit a review
const review = await client.productReviews.submitReview({
  product: { key: 'product-123' },
  rating: 5,
  title: 'Great product!',
  content: 'I really love this product.',
  authorName: 'John Doe',
});
```
