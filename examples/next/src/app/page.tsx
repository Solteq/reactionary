import styles from './page.module.scss';
import { ClientBuilder, NoOpCache, SessionSchema } from '@reactionary/core';
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
        },
        { search: true, product: false, identity: false }
      )
    )
    .withCache(new NoOpCache())
    .build();

  const session = SessionSchema.parse({
    id: '1234567890',
  });

  const search = await client.search.queryByTerm({
    search: {
      facets: [],
      page: 0,
      pageSize: 12,
      term: 'glass',
    },
  }, session);

  return <div className={styles.page}>
        {search.products.map((product, index) => (
          <div key={index}>
            { product.name }
          </div>
        ))}
  </div>;
}
