import { inject, Injectable, resource } from '@angular/core';
import { TRPC } from './trpc.client';
import { ActivationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

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
    request: () => ({
      slug: this.slug(),
    }),
    loader: async ({ request }) => {
      if (request.slug) {
        return this.client.client.product.query({
          ...request,
          type: 'BySlug'
        });
      } else {
        return undefined;
      }
    },
  });
}
