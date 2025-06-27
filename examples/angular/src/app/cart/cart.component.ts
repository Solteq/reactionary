import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TRPC } from '../services/trpc.client';
import { Cart } from '@reactionary/core';

@Component({
  selector: 'app-cart',
  imports: [CommonModule],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
  encapsulation: ViewEncapsulation.ShadowDom,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartComponent {
  protected trpc = inject(TRPC);
  protected cart = signal<Cart | undefined>(undefined);

  protected async add() {
    const c = await this.trpc.client.cartMutation.mutate([
      {
        mutation: 'add',
        cart: {
          key: this.cart()?.identifier.key || '',
        },
        product: {
          key: 'ad153f54-6ae9-4800-8e5e-b40a07eb87b4',
        },
        quantity: 2,
      },
    ]);

    this.cart.set(c);
  }

  protected async adjust() {
    const existing = this.cart();

    if (existing) {
      const c = await this.trpc.client.cartMutation.mutate([
        {
          mutation: 'adjustQuantity',
          cart: existing.identifier,
          item: existing.items[0].identifier,
          quantity: existing.items[0].quantity + 1,
        },
      ]);

      this.cart.set(c);
    }
  }

  protected async remove() {
    const existing = this.cart();

    if (existing) {
      const c = await this.trpc.client.cartMutation.mutate([
        {
          mutation: 'remove',
          cart: existing.identifier,
          item: existing.items[0].identifier,
        },
      ]);

      this.cart.set(c);
    }
  }
}
