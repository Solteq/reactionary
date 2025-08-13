import { inject, Injectable, resource } from '@angular/core';
import { TRPC } from './trpc.client';
import { ActivationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { Product } from '@reactionary/core';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  protected client = inject(TRPC);
  protected router = inject(Router);
  protected slug = toSignal(
    this.router.events.pipe(filter(x => x instanceof ActivationEnd), map(x => x.snapshot.params['slug'])),
    { initialValue: '' }
  );

  public productResource = resource({
    params: () => ({
      slug: this.slug(),
    }),
    loader: async ({ params }) => {
      if (params.slug) {
        const results = await this.client.client.product.query([{
          query: 'slug',
          slug: params.slug,
        }]);

        return results[0];
      } else {
        return undefined;
      }
    },
  });
}
