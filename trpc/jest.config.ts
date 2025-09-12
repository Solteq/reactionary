export default {
  displayName: 'trpc',
  preset: '../jest.preset.js',
  testEnvironment: 'node',
  testTimeout: 15000,
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  moduleNameMapper: {
    '^superjson$': '<rootDir>/__mocks__/superjson.js',
  },
  coverageDirectory: '../coverage/trpc',
};
