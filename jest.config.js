export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'json-summary'
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 75,
      functions: 90,
      lines: 90
    }
  }
};
