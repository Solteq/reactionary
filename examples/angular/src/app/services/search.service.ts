import { inject, Injectable, linkedSignal, resource, signal } from '@angular/core';
import { FacetValueIdentifier, SearchResult } from '@reactionary/core';
import { TRPC } from './trpc.client';

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  protected client = inject(TRPC);

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
      const result = await this.client.client.search.query([{
        query: 'term',
        search: {
          ...request
        }
      }]);

      return result[0];
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
