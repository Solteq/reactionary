import { Component, resource, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { buildClient } from '@reactionary/core';
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
        apiKey: '1f3c6a681eadb77fbf42ca148ace0767',
        appId: 'G10R4JEVO1',
        indexName: 'martinrogne-products'
      },
      { search: true, products: true }
    )
  ]);

  protected pageSize = signal(20);
  protected page = signal(0);
  protected term = signal('glass');
  protected facets = signal([]);

  protected search = resource({
    request: () => ({ pageSize: this.pageSize(), page: this.page(), term: this.term(), facets: this.facets() }),
    loader: async ({ request }) => {
      return this.client.search.get(request);
    }
  });
}
