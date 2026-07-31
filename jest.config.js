module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  testEnvironmentOptions: {
    resources: 'usable',
    runScripts: 'dangerously',
  },
  moduleDirectories: ['node_modules', 'www'],
};
