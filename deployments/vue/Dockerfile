FROM docker.io/node:lts-alpine

WORKDIR /app

RUN addgroup --system vue && \
          adduser --system -G vue vue

COPY dist/deployments/vue server/
COPY dist/examples/vue client/
RUN chown -R vue:vue server

# You can remove this install step if you build with `--bundle` option.
# The bundled output will include external dependencies.
RUN npm --prefix server --omit=dev -f install

CMD [ "node", "server" ]