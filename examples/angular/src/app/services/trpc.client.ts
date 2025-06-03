import { Injectable } from "@angular/core";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

// FIXME: move the router to a buildable library, to allow importing it
// eslint-disable-next-line @nx/enforce-module-boundaries 
import { RouterType } from '../../../../trpc-node/src/router';

@Injectable({
    providedIn: 'root',
  })
  export class TRPC {
    public client = createTRPCClient<RouterType>({
      links: [
        httpBatchLink({
          url: 'http://localhost:3000/trpc',
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: 'include',
            });
          },
        }),
      ],
    });
  }