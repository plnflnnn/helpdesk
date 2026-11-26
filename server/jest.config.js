/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // Better Auth and the generated Prisma client are ESM-only, so tests run as native ESM
  // (the test script sets NODE_OPTIONS=--experimental-vm-modules).
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json', useESM: true }],
  },
  moduleNameMapper: {
    // `@/` aliases src/ (see tsconfig paths).
    '^@/(.*)\\.js$': '<rootDir>/src/$1',
    '^@generated/(.*)\\.js$': '<rootDir>/generated/$1',
    // Source files use ESM-style `.js` import specifiers; resolve them to the .ts files.
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Test against shared source directly so tests don't depend on a shared build.
    '^@helpdesk/shared$': '<rootDir>/../shared/src/index.ts',
  },
  // Sets the test environment variables before each test file.
  setupFiles: ['<rootDir>/src/test/setup-env.ts'],
  // Applies migrations to the test database once per run.
  globalSetup: '<rootDir>/src/test/global-setup.ts',
  // Integration tests share one database.
  maxWorkers: 1,
};
