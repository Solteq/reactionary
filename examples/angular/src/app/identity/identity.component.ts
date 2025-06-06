import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TRPC } from '../services/trpc.client';
import { Identity } from '@reactionary/core';

@Component({
  selector: 'app-identity',
  imports: [CommonModule],
  templateUrl: './identity.component.html',
  styleUrl: './identity.component.scss',
  encapsulation: ViewEncapsulation.ShadowDom,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityComponent {
  protected trpc = inject(TRPC);
  protected identity = signal<Identity | undefined>(undefined);
  
  protected async login(username: string, password: string) {
    const res = await this.trpc.client.login.mutate({
      username,
      password
    });

    this.identity.set(res);
  }

  protected async logout() {
    const res = await this.trpc.client.logout.mutate();

    this.identity.set(res);
  }

  protected async refresh() {
    const res = await this.trpc.client.identity.query();

    this.identity.set(res);
  }
}
