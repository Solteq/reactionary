// Mock superjson for Jest testing
module.exports = {
  default: {
    stringify: JSON.stringify,
    parse: JSON.parse,
    serialize: (obj) => ({ json: obj, meta: undefined }),
    deserialize: (data) => data.json,
    output: {
      serialize: (obj) => ({ json: obj, meta: undefined })
    },
    input: {
      deserialize: (data) => data.json
    }
  },
  stringify: JSON.stringify,
  parse: JSON.parse,
  serialize: (obj) => ({ json: obj, meta: undefined }),
  deserialize: (data) => data.json,
  output: {
    serialize: (obj) => ({ json: obj, meta: undefined })
  },
  input: {
    deserialize: (data) => data.json
  }
};