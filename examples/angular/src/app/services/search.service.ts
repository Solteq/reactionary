import { Injectable, linkedSignal, resource, signal } from '@angular/core';
import { buildClient, FacetValueIdentifier, SearchResult } from '@reactionary/core';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  protected client = buildClient([
    withAlgoliaCapabilities(
      {
        apiKey: '49a820e012607cd2c5a72b8ffc8d0029',
        appId: 'BPS0QU5YHD',
        indexName: 'products',
      },
      { search: true, products: true }
    ),
  ]);

  public pageSize = signal(20);
  public page = signal(0);
  public term = signal('glass');
  public facets = signal(new Array<FacetValueIdentifier>());

  protected searchResource = resource({
    request: () => ({
      pageSize: this.pageSize(),
      page: this.page(),
      term: this.term(),
      facets: this.facets(),
    }),
    loader: async ({ request }) => {
      return this.client.search.get(request);
    },
  });

  public search = linkedSignal<
    SearchResult | undefined,
    SearchResult | undefined
  >({
    source: () => this.searchResource.value(),
    computation: (source, previous) => {
      if (source) {
        return source;
      }

      return previous?.value;
    },
  }).asReadonly();
}
