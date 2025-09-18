import styles from './page.module.scss';
import { ClientBuilder, NoOpCache, SessionSchema } from '@reactionary/core';
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
    

  const session = SessionSchema.parse({
    id: '1234567890',
    languageContext: {
      countryCode: 'US',
      languageCode: 'en',
      currencyCode: 'USD',
    },
  });

  const search = await client.search.queryByTerm(
    {
      search: {
        facets: [],
        page: 1,
        pageSize: 12,
        term: 'glass',
      },
    },
    session
  );

  return (
    <div className={styles.page}>
      {search.products.map((product, index) => (
        <div key={index}>{product.name}</div>
      ))}
    </div>
  );
}
