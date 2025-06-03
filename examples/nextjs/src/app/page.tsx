'use client'

import styles from './page.module.scss';
import { buildClient, FacetValueIdentifier, SearchIdentifier, SearchResult } from '@reactionary/core';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';
import { useEffect, useState } from 'react';

export default function Index() {
  const [query, setQuery] = useState<SearchIdentifier>({
    term: 'glass',
    facets: [],
    page: 0,
    pageSize: 20
  });

  const [pagination, setPagination] = useState({
    hasNextPage: false,
    hasPreviousPage: false
  });

  const [search, setSearch] = useState<SearchResult | undefined>(undefined);

  useEffect(() => {
    // TODO: Move out into a getDataClient(...)
    const client = buildClient([
      withAlgoliaCapabilities(
        {
          apiKey: '6182ae56fe75db797b05a2d41fcd8ef9',
          appId: 'BPS0QU5YHD',
          indexName: 'products',
        },
        { search: true, product: true }
      ),
    ]);

    async function fetchPosts() {
      const data = await client.search.get(query);

      setSearch(data);
      setPagination({
        hasPreviousPage: data.identifier.page > 0,
        hasNextPage: query.page < (data.pages - 1)
      });
    }

    fetchPosts()
  }, [query])

  function toggleFacet(value: FacetValueIdentifier) {
    const newQuery = {
      ...query
    };

    const old = newQuery.facets;
    const existingIndex = old.findIndex(
      (x) => JSON.stringify(x) === JSON.stringify(value)
    );

    if (existingIndex > -1) {
      newQuery.facets.splice(existingIndex, 1);
    } else {
      newQuery.facets.push(value);
    }

    setQuery(newQuery);
  }

  function previousPage() {
    const newQuery = {
      ...query,
    }

    newQuery.page--;

    setQuery(newQuery);
  }

  function nextPage() {
    const newQuery = {
      ...query,
    }

    newQuery.page++;

    setQuery(newQuery);
  }

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
            search?.facets.map(facet =>
              <details key={ facet.identifier.key }>
                <summary>
                  { facet.name }
                </summary>
                <div>
                  {
                      facet.values.map(facetValue =>
                        <label key={ facetValue.identifier.key }>
                          <span>{ facetValue.name }</span>
                          <span>{ facetValue.count }</span>
                          <input type="checkbox" checked={ facetValue.active } onChange={(e) => toggleFacet(facetValue.identifier) } />
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
            search?.products.map(product =>
              <article key={ product.identifier.key }>
                <img src={product.image.replace('w_200', 'w_200,h_200')} />
                <h3>{ product.name }</h3>
              </article>
            )
          }
        </section>
      </main>
      <footer>
        <button disabled={ !pagination.hasPreviousPage } onClick={ previousPage }>&lt;</button>
        <button disabled={ !pagination.hasNextPage} onClick={ nextPage }>&gt;</button>
      </footer>
    </div>
  );
}
