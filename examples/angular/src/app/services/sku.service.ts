import { inject, Injectable, resource } from '@angular/core';
import { TRPC } from './trpc.client';
import { ActivationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { Product } from '@reactionary/core';
import { ProductService } from './product.service';

@Injectable({
  providedIn: 'root',
})
export class SKUService {
  protected productService = inject(ProductService);

  public sku = resource({
    params: () => ({
      product: this.productService.productResource.value()
    }),
    loader: async ({ params }) => {
      if (params.product) {
        return params.product.skus[0];
      }

      return undefined;
    },
  });
}
