<script setup lang="ts">
  import { buildClient } from '@reactionary/core';
  import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';
  import { ref, watch, reactive, computed } from 'vue';

  const client = buildClient([
    withAlgoliaCapabilities(
      {
        apiKey: '06895056a3e91be5f5a1bc6d580d3ca4',
        appId: '3WEOFTHPZD',
        indexName: 'reactionary-products',
      },
      { search: true, products: true }
    ),
  ]);

  const result = ref(null);
  const query = reactive({
    term: '',
    facets: [],
    page: 0,
    pageSize: 20
  });

  watch(query, async (q) => {
    result.value = await client.search.get({
      term: q.term,
      facets: q.facets,
      page: q.page,
      pageSize: q.pageSize
    });
  }, { immediate: true });

  const hasNextPage = computed(() => {
    return query.page <= (result.value?.pages || 0) - 1;
  });

  const hasPreviousPage = computed(() => {
    return query.page > 0;
  });

  function toggleFacet(value) {
    const old = query.facets;
    const existingIndex = old.findIndex(x => JSON.stringify(x) === JSON.stringify(value));

    if (existingIndex > -1) {
      query.facets.splice(existingIndex, 1)
    } else {
      query.facets.push(value);
    }
  }
</script>

<template>
  <div class="host">
    <header>
      <input @change="event => query.term = event.target.value"/>
    </header>
    <main>
      <aside>
        <details v-for="facet in result?.facets">
          <summary>
            {{ facet.name }}
          </summary>
          <div>
            <label v-for="value of facet.values">
              <span>{{ value.name }}</span>
              <span>{{ value.count }}</span>
              <input type="checkbox" :checked="value.active" @click="event => toggleFacet(value.identifier)" />
            </label>
          </div>
        </details>
      </aside>
      <section>
        <article v-for="product in result?.products">
          <img :src="product.image.replace('w_200', 'w_200,h_200')" />
          <h3>{{ product.name }}</h3>
        </article>
      </section>
    </main>
    <footer>
      <button :disabled="!hasPreviousPage" @click="event => query.page--">&lt;</button>
      <button :disabled="!hasNextPage" @click="event => query.page++">&gt;</button>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
.host {
  input,
  h3,
  button,
  a {
    all: unset;
    box-sizing: border-box;
  }

header {
  width: 100%;
  padding: 0.5rem;

  input {
    padding-inline: 1rem;
    color: rgb(205, 214, 244);
    background: rgb(88, 91, 112);
    width: 100%;
    height: 3rem;
    border-radius: 0.5rem;
  }
}

main {
  padding-inline: 0.5rem;
  display: grid;
  gap: 0.5rem;
  grid-template-columns: 300px 1fr;
  color: rgb(205, 214, 244);
}

details[open] {
  summary:after {
    content: '-';
  }
}

details {
  position: relative;
  background: rgb(49, 50, 68);
  border-radius: 0.5rem;
}

summary {
  font-weight: bold;
  text-transform: capitalize;
  list-style: none;
  padding: 0.5rem;

  &::-webkit-details-marker {
    display: none;
  }

  &::after {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    content: '+';
    line-height: 1;
  }
}

aside {
  display: grid;
  grid-template-columns: 1fr;
  grid-auto-rows: min-content;
  gap: 0.25rem;

  div {
    display: grid;
    grid-template-columns: 1fr min-content min-content;
    grid-auto-rows: min-content;
    padding: 0.5rem;
    gap: 0.5rem;

    a {
      display: contents;
    }

    label {
      grid-column: span 3;
      display: grid;
      grid-template-columns: subgrid;
      align-items: center;
      gap: 0.5rem;

      input {
        width: 1.5rem;
        height: 1.5rem;
        background: rgb(147, 153, 178);
        border-radius: 0.125rem;

        &:checked {
            background: rgb(137, 220, 235);
        }
      }
    }
  }
}

section {
  justify-content: center;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  grid-auto-rows: min-content;
  gap: 0.5rem;
}

article {
  background: rgb(49, 50, 68);
  border-radius: 0.25rem;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr min-content;
  gap: 1rem;

  h3 {
    line-height: 1.2;
    font-size: 1rem;
    text-align: center;
    margin-bottom: 1rem;
  }

  img {
    object-fit: contain;
    border-top-left-radius: inherit;
    border-top-right-radius: inherit;
    max-width: 100%;
    width: 100%;
  }
}

footer {
  margin: 0.5rem;
  gap: 0.25rem;
  display: grid;
  grid-template-columns: min-content min-content;
  align-items: center;
  justify-content: center;
}

button {
  display: grid;
  justify-content: center;
  align-items: center;

  height: 3rem;
  background: rgb(49, 50, 68);
  color: rgb(205, 214, 244);
  aspect-ratio: 1 / 1;
  border-radius: 0.25rem;

  &:disabled {
    opacity: 0.5;
  }
}
}




</style>
