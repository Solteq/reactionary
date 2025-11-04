import styles from './page.module.scss';
import { ClientBuilder, createInitialRequestContext, NoOpCache } from '@reactionary/core';
import { withFakeCapabilities } from '@reactionary/provider-fake';

export default async function Index() {
  const client = new ClientBuilder()
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

  const reqCtx = createInitialRequestContext();
  reqCtx.correlationId = 'nextjs-request-' + (new Date().getTime());
  const search = await client.productSearch.queryByTerm(
    {
      search: {
        facets: [],
        paginationOptions: {
          pageNumber: 1,
          pageSize: 12,
        },
        term: 'glass',
        filters: []
      },
    },
    reqCtx
  );

  return (
    <div className={styles.page}>
      {search.items.map((product, index) => (
        <div key={index}>{product.name}</div>
      ))}
    </div>
  );
}
