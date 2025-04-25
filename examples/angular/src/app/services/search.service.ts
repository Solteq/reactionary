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
        apiKey: '06895056a3e91be5f5a1bc6d580d3ca4',
        appId: '3WEOFTHPZD',
        indexName: 'reactionary-products',
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
