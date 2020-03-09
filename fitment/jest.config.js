module.exports = {
  coverageThreshold: {
    global: {
      lines: 1
    }
  },
  collectCoverage: true,
  verbose: true,
  notify: true,
  coverageDirectory: 'reports/coverage',
  rootDir: '.',
  transform: {
    '\\.ts$': 'ts-jest',
  },
  testResultsProcessor: 'jest-bamboo-reporter',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
  ],
  moduleFileExtensions: ['ts', 'js'],
  testEnvironment: 'node',
};
