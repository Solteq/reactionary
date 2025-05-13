import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    {
        path: 'search',
        loadComponent: () => import('./search/search.component').then(x => x.SearchComponent)
    },
    {
        path: 'product/:slug',
        loadComponent: () => import('./product/product.component').then(x => x.ProductComponent)
    }
];
