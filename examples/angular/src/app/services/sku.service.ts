import { computed, inject, Injectable } from '@angular/core';
import { TRPC } from './trpc.client';
import { ProductService } from './product.service';

@Injectable({
  providedIn: 'root',
})
export class SKUService {
  protected client = inject(TRPC);
  protected product = inject(ProductService);

  public state = computed(() => {
    return this.product.productResource.value()?.skus[0];
  });
}
