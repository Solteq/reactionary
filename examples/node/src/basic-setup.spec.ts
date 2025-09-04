import { buildClient, NoOpCache } from '@reactionary/core';
import { withFakeCapabilities } from '@reactionary/provider-fake';
import { createTRPCRouter } from '@reactionary/trpc';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { createTRPCClient, httpBatchLink } from '@trpc/client';

describe('basic setup', () => {
  let server: any;

  it('should be able to create a trpc server and client and retrieve a product', async () => {
    const client = buildClient(
      [
        withFakeCapabilities(
          {
            jitter: {
              mean: 300,
              deviation: 100,
            },
          },
          { search: true, product: true, identity: true }
        ),
      ],
      {
        cache: new NoOpCache(),
      }
    );

    const mergedRouter = createTRPCRouter(client);

    type RouterType = typeof mergedRouter;

    server = createHTTPServer({
      router: mergedRouter,
      createContext() {
        return {} as any;
      },
    });

    server.listen(3000);

    const trpc = createTRPCClient<RouterType>({
      links: [
        httpBatchLink({
          url: 'http://localhost:3000',
        }),
      ],
    });

    const product = await trpc.product.query([
      {
        query: 'id',
        id: '1234',
      },
    ]);

    expect(product[0].identifier.key).toBe('1234');
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });
});
