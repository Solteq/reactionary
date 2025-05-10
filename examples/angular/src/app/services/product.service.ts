import { inject, Injectable, resource, signal } from '@angular/core';
import { TRPC } from './trpc.client';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  public client = inject(TRPC);

  protected route = inject(ActivatedRoute);
  protected slug = toSignal(
    this.route.firstChild!.params.pipe(map((params) => params['slug'])),
    { initialValue: '' }
  );

  public productResource = resource({
    request: () => ({
      slug: this.slug(),
    }),
    loader: async ({ request }) => {
      if (request.slug) {
        return this.client.client.product.query(request);
      } else {
        return undefined;
      }
    },
  });
}
