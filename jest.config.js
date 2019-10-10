const jestConfig = {
  globals: {
    'ts-jest': {
      tsConfig: 'tsconfig.json'
    }
  },
  verbose: true,
  notify: true,
  testRegex: '\\.test\\.ts$',
  testEnvironment: 'node',
  testResultsProcessor: 'jest-bamboo-reporter',
  transformIgnorePatterns: [
    'node_modules'
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleFileExtensions: [
    'js',
    'ts'
  ],
  moduleDirectories: [
    './node_modules',
    './src'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.js'
  ],
  coverageThreshold: {
    global: {
      lines: 1
    }
  },
  coverageDirectory: 'reports/coverage',
  setupFiles: []
};
module.exports = jestConfig;
