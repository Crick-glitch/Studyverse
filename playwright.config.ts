import { defineConfig } from '@playwright/test';

// Installed in Phase 1; end-to-end tests are added in later phases (see 06 and 08).
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5173' },
});
