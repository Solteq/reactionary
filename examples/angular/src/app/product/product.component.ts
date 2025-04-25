import { Component, inject, resource } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { buildClient } from '@reactionary/core';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';
import { withCommercetoolsCapabilities } from '@reactionary/provider-commercetools';

@Component({
  selector: 'app-product',
  imports: [CommonModule],
  templateUrl: './product.component.html',
  styleUrl: './product.component.scss',
})
export class ProductComponent {
  protected route = inject(ActivatedRoute);
  protected slug = toSignal(
    this.route.params.pipe(map((params) => params['slug'])),
    { initialValue: '' }
  );
  protected client = buildClient([
    withAlgoliaCapabilities(
      {
        // Read key
        apiKey: '06895056a3e91be5f5a1bc6d580d3ca4',
        appId: '3WEOFTHPZD',
        indexName: 'reactionary-products',
      },
      { search: true, products: false }
    ),
    withCommercetoolsCapabilities(
      {
        apiUrl: 'https://api.europe-west1.gcp.commercetools.com',
        authUrl: 'https://auth.europe-west1.gcp.commercetools.com',
        clientId: '',
        clientSecret: '',
        projectKey: 'perpendicular'
      },
      { products: true }
    ),
  ]);

  protected productResource = resource({
    request: () => ({
      slug: this.slug(),
    }),
    loader: async ({ request }) => {
      return this.client.product.get(request);
    },
  });
}
