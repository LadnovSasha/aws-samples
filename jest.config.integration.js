const jestConfig = require('./jest.config.js');
jestConfig.testRegex = "\\.itest\\.ts$";
jestConfig.collectCoverage = false;
module.exports = jestConfig;
