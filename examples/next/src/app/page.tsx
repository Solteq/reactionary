import styles from './page.module.scss';
import { ClientBuilder, createInitialRequestContext, NoOpCache, SessionSchema } from '@reactionary/core';
import { withFakeCapabilities } from '@reactionary/provider-fake';
import { withCommercetoolsCapabilities } from '@reactionary/provider-commercetools';

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
        { search: true, product: true, identity: false }
      )
    )
    .withCache(new NoOpCache())
    .build();

  const reqCtx = createInitialRequestContext();
  reqCtx.correlationId = 'nextjs-request-' + (new Date().getTime());
  const search = await client.search.queryByTerm(
    {
      search: {
        facets: [],
        page: 1,
        pageSize: 12,
        term: 'glass',
      },
    },
    reqCtx
  );

  return (
    <div className={styles.page}>
      {search.products.map((product, index) => (
        <div key={index}>{product.name}</div>
      ))}
    </div>
  );
}
