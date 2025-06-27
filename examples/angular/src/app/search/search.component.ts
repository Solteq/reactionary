import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchService } from '../services/search.service';
import { FacetValueIdentifier } from '@reactionary/core';
import { RouterModule } from '@angular/router';
import { TRPC } from '../services/trpc.client';

@Component({
  selector: 'app-search',
  imports: [CommonModule, RouterModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent {
  protected service = inject(SearchService);
  protected client = inject(TRPC);

  protected hasNext = computed(() => {
    return this.service.page() >= (this.service.search()?.pages || 0) - 1;
  });

  protected hasPrevious = computed(() => {
    return !(this.service.page() > 0);
  });

  protected previousPage() {
    this.service.page.update((old) => old - 1);
  }

  protected nextPage() {
    this.service.page.update((old) => old + 1);
  }

  protected toggleFacet(value: FacetValueIdentifier) {
    this.service.facets.update((old) => {
      const existingIndex = old.findIndex(
        (x) => JSON.stringify(x) === JSON.stringify(value)
      );

      if (existingIndex > -1) {
        const updated = [...old];
        updated.splice(existingIndex, 1);

        return updated;
      } else {
        return [...old, value];
      }
    });
  }
}
