module.exports = {
  displayName: '$lib',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm/)?@nestjs|.pnpm/@prisma/)',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
};