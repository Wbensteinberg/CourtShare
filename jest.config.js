const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  // Use jsdom environment to simulate browser DOM for React component testing
  testEnvironment: 'jest-environment-jsdom',
  
  // Run jest.setup.ts before each test to configure testing environment
  // This file imports @testing-library/jest-dom and sets up TextEncoder/TextDecoder
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  
  // Configure module resolution to look in node_modules and project root
  // This allows imports from both installed packages and local files
  moduleDirectories: ['node_modules', '<rootDir>/'],
};

module.exports = createJestConfig(customJestConfig); 