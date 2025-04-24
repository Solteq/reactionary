import { Component, computed, effect, linkedSignal, resource, ResourceStatus, signal, WritableSignal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { buildClient, FacetValueIdentifier, SearchResult } from '@reactionary/core';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
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

  protected pageSize = signal(20);
  protected page = signal(0);
  protected term = signal('glass');
  protected facets = signal(new Array<FacetValueIdentifier>());

  protected searchResource = resource({
    request: () => ({
      pageSize: this.pageSize(),
      page: this.page(),
      term: this.term(),
      facets: this.facets(),
    }),
    loader: async ({ request }) => {
      return this.client.search.get(request);
    }
  });

  protected search = linkedSignal<SearchResult | undefined, SearchResult | undefined>({
    source: () => this.searchResource.value(),
    computation: (source, previous) => {
      if (source) {
        return source;
      }

      return previous?.value;
    }
  })

  protected hasNext = computed(() => {
    return this.page() >= (this.search()?.pages || 0) - 1;
  });

  protected hasPrevious = computed(() => {
    return !(this.page() > 0);
  });

  protected previousPage() {
    this.page.update((old) => old - 1);
  }

  protected nextPage() {
    this.page.update((old) => old + 1);
  }

  protected toggleFacet(value: FacetValueIdentifier) {
    this.facets.update((old) => {
      const existingIndex = old.findIndex(x => JSON.stringify(x) === JSON.stringify(value));

      if (existingIndex > -1) {
        const updated = [...old];
        updated.splice(existingIndex, 1)

        return updated;
      } else {
        return [...old, value];
      }
    });
  }
}
