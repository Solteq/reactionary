import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    {
        path: 'search',
        loadComponent: () => import('./search/search.component').then(x => x.SearchComponent)
    },
    {
        path: 'product/:slug',
        loadComponent: () => import('./product/product.component').then(x => x.ProductComponent)
    },
    {
        path: 'identity',
        loadComponent: () => import('./identity/identity.component').then(x => x.IdentityComponent)
    },
    {
        path: 'cart',
        loadComponent: () => import('./cart/cart.component').then(x => x.CartComponent)
    },
    {
        path: '**',
        pathMatch: 'prefix',
        redirectTo: 'search'
    }
];
