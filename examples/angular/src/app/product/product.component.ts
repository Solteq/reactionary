import { Component, inject, resource } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { buildClient } from '@reactionary/core';
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
    withCommercetoolsCapabilities(
      {
        apiUrl: 'https://api.europe-west1.gcp.commercetools.com',
        authUrl: 'https://auth.europe-west1.gcp.commercetools.com',
        // Read key
        clientId: 'qerkG2wiftLupQnKHeW-OZ6a',
        clientSecret: '0LK3aWUDBRrMUXh5rJBKtC5S1qZJznsn',
        projectKey: 'perpendicular'
      },
      { products: true, search: true }
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
