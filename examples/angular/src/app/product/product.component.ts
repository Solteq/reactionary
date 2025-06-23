import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../services/product.service';
import { TRPC } from '../services/trpc.client';

@Component({
  selector: 'app-product',
  imports: [CommonModule],
  templateUrl: './product.component.html',
  styleUrl: './product.component.scss',
})
export class ProductComponent {
  protected service = inject(ProductService);
  protected trpc = inject(TRPC);

  constructor() {
    effect(async () => {
      const product = this.service.productResource.value();

      console.log('product: ', product);

      if (product && product.skus.length > 0) {
        const inventory = await this.trpc.client.inventory.query({
          sku: product.skus[0].identifier.key,
        });
        console.log('inventory: ', inventory);

        const prices = await this.trpc.client.price.query([
          { sku: product.skus[0].identifier, query: 'sku' },
        ]);
        console.log('price: ', prices);

        const pricesWithUnknownSku = await this.trpc.client.price.query([
          { sku: product.skus[0].identifier, query: 'sku' },
          { sku: { key: '123456' }, query: 'sku' },
        ]);
        console.log('pricesWithUnknownSku: ', pricesWithUnknownSku);
      }
    });
  }
}
