import { createMixedClient } from "./002-client-setup-mixed-providers.example.js";

const client = createMixedClient();

const search = await client.productSearch.byTerm.execute({
  search: {
    facets: [],
    filters: [],
    term: 'test',
    paginationOptions: {
      pageNumber: 1,
      pageSize: 20,
    },
  },
});

if (!search.success) {
    throw Error("This should not be happening...");
}

const selectedVariant = search.value.items[0].variants[0];
const initialCartOperation = await client.cart.add.execute({
    quantity: 1,
    variant: selectedVariant.variant
});

if (!initialCartOperation.success) {
    throw Error("This REALLY shouldn't be happening...");
}

const secondSelectedVariant = search.value.items[1].variants[0];
const secondCartOperation = await client.cart.add.execute({
    quantity: 1,
    variant: secondSelectedVariant.variant,
    cart: initialCartOperation.value.identifier
});

if (!secondCartOperation.success) {
    throw Error("Something went terribly wrong...");
}
