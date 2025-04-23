import styles from './page.module.scss';
import { buildClient } from '@reactionary/core';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';

export default async function Index() {
  const client = buildClient([
    withAlgoliaCapabilities(
      {
        apiKey: '1f3c6a681eadb77fbf42ca148ace0767',
        appId: 'G10R4JEVO1',
        indexName: 'martinrogne-products',
      },
      { search: true, products: true }
    ),
  ]);

  const result = await client.search.get({
    term: 'glass',
    facets: [],
    page: 0,
    pageSize: 20
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
                        <label key={ facetValue.identifier.id }>
                          <span>{ facetValue.name }</span>
                          <span>{ facetValue.count }</span>
                          <input type="checkbox" checked={ facetValue.active } readOnly />
                        </label>
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
