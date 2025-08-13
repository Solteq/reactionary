import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../services/product.service';
import { TRPC } from '../services/trpc.client';
import { SKUService } from '../services/sku.service';

@Component({
  selector: 'app-product',
  imports: [CommonModule],
  templateUrl: './product.component.html',
  styleUrl: './product.component.scss',
})
export class ProductComponent {
  protected service = inject(ProductService);
  protected skuService = inject(SKUService);
  protected trpc = inject(TRPC);

  constructor() {
    effect(async () => {
      const product = this.service.productResource.value();
      const sku = this.skuService.sku.value();

      console.log('product: ', product);
      console.log('sku: ', sku);
    });
  }
}
