FROM docker.io/node:lts-alpine

WORKDIR /app

RUN addgroup --system angular-trpc && \
          adduser --system -G angular-trpc angular-trpc

COPY dist/deployments/angular-trpc angular-trpc/
COPY dist/examples/angular angular-trpc/client
RUN chown -R angular-trpc:angular-trpc .

# You can remove this install step if you build with `--bundle` option.
# The bundled output will include external dependencies.
RUN npm --prefix angular-trpc --omit=dev -f install

CMD [ "node", "angular-trpc" ]