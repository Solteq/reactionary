import styles from './page.module.scss';
import {
  ClientBuilder,
  createInitialRequestContext,
  NoOpCache,
} from '@reactionary/core';
import { withFakeCapabilities } from '@reactionary/provider-fake';

export default async function Index() {
  const reqCtx = createInitialRequestContext();
  reqCtx.correlationId = 'nextjs-request-' + new Date().getTime();

  const client = new ClientBuilder(reqCtx)
    .withCapability(
      withFakeCapabilities(
        {
          jitter: {
            mean: 0,
            deviation: 0,
          },
          seeds: {
            product: 1,
            search: 1,
            category: 1,
          },
        },
        { productSearch: true, product: true, identity: false }
      )
    )
    .withCache(new NoOpCache())
    .build();

  const search = await client.productSearch.queryByTerm({
    search: {
      facets: [],
      paginationOptions: {
        pageNumber: 1,
        pageSize: 12,
      },
      term: 'glass',
      filters: [],
    },
  });

  if (!search.success) {
    return (
      <div className={styles.page}>
        An error occured...
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {search.value.items.map((product, index) => (
        <div key={index}>{product.name}</div>
      ))}
    </div>
  );
}
