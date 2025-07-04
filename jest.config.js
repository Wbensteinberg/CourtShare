const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  // Use jsdom environment to simulate browser DOM for React component testing
  testEnvironment: 'jest-environment-jsdom',
  
  // Add this to handle React 19's export conditions
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  
  // Run jest.setup.ts before each test to configure testing environment
  // This file imports @testing-library/jest-dom and sets up TextEncoder/TextDecoder
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  
  // Configure module resolution to look in node_modules and project root
  // This allows imports from both installed packages and local files
  moduleDirectories: ['node_modules', '<rootDir>/'],
  
  // Add path mapping for the @ alias and mock next/image
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^next/image$': '<rootDir>/__mocks__/next/image.js',
  },

  // 👇 Add this to handle React 18/19 export conditions
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },

  // 👇 Add this to handle React 18/19 export conditions
  transformIgnorePatterns: [
    '/node_modules/(?!react-dom|react)',
  ],

  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};

module.exports = createJestConfig(customJestConfig); 