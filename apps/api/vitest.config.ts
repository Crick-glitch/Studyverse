import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./src/test/globalSetup.ts'],
    // Integration tests share one database; run files one at a time for deterministic results.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
