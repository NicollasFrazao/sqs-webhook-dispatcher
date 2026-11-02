import { defineConfig } from 'vitest/config';

const COVERAGE_THRESHOLD = 80;

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: [
        'src/**/*.ts',
        'infra/**/*.ts',
      ],
      // Entry points only wire tested parts together: the Lambda handler binds the
      // AWS clients and the environment, the CDK app instantiates the stack.
      // `npm run synth` in CI is their check.
      exclude: [
        'src/handler.ts',
        'infra/app.ts',
      ],
      reporter: [
        'text',
        'lcov',
      ],
      thresholds: {
        lines: COVERAGE_THRESHOLD,
        branches: COVERAGE_THRESHOLD,
        functions: COVERAGE_THRESHOLD,
        statements: COVERAGE_THRESHOLD,
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'tooling',
          include: [
            'eslint-rules/**/*.test.mjs',
            'scripts/**/*.test.mjs',
          ],
        },
      },
    ],
  },
});
