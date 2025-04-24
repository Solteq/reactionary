import styles from './page.module.scss';
import { buildClient } from '@reactionary/core';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';
import Link from 'next/link';

export default async function Index({ searchParams }) {
  const params = await searchParams;
  const term = params.term || '';
  const pageSize = Number(params.pageSize) || 20;
  const page = Number(params.page) || 0;

  const client = buildClient([
    withAlgoliaCapabilities(
      {
        apiKey: '06895056a3e91be5f5a1bc6d580d3ca4',
        appId: '3WEOFTHPZD',
        indexName: 'reactionary-products',
      },
      { search: true, products: true }
    ),
  ]);

  const result = await client.search.get({
    term,
    facets: [],
    page,
    pageSize
  });

  /*
   * Replace the elements below with your own.
   *
   * Note: The corresponding styles are in the ./index.scss file.
   */
  return (
    <div className={ styles.host }>
      <header>
        <input />
      </header>
      <main>
        <aside>
          {
            result.facets.map(facet =>
              <details key={ facet.identifier.id }>
                <summary>
                  { facet.name }
                </summary>
                <div>
                  {
                      facet.values.map(facetValue =>
                        <Link key={ facetValue.identifier.id } href={{
                          query: { ...params, name: 'foo' }
                        }}>
                          <label>
                            <span>{ facetValue.name }</span>
                            <span>{ facetValue.count }</span>
                            <input type="checkbox" checked={ facetValue.active } readOnly />
                          </label>
                        </Link>
                      )
                  }
                </div>
              </details>
            )
          }
        </aside>
        <section>
          {
            result.products.map(product =>
              <article key={ product.identifier.id }>
                <img src={product.image.replace('w_200', 'w_200,h_200')} />
                <h3>{ product.name }</h3>
              </article>
            )
          }
        </section>
      </main>
      <footer>
        <button>&lt;</button>
        <button>&gt;</button>
      </footer>
    </div>
  );
}
