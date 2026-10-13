module.exports = {
  displayName: 'loans',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm/)?@nestjs|.pnpm/@prisma/)',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
};
