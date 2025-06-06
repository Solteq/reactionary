import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SearchService } from './services/search.service';
import { TRPC } from './services/trpc.client';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected service = inject(SearchService);
}
