module.exports = {
  displayName: '@org/web',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^../../api$': '<rootDir>/src/api/__mocks__/index.ts',
    '^../../api/(.*)$': '<rootDir>/src/api/__mocks__/$1.ts',
    '^../api$': '<rootDir>/src/api/__mocks__/index.ts',
    '^../api/(.*)$': '<rootDir>/src/api/__mocks__/$1.ts',
    '^../hooks/(.*)$': '<rootDir>/src/app/hooks/__mocks__/$1.ts',
    '^../../hooks/(.*)$': '<rootDir>/src/app/hooks/__mocks__/$1.ts',
  },
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: 'test-output/jest/coverage',
};
