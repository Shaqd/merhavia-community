import { defineConfig } from 'vitest/config';

// Root tests cover repo tooling only. Each app runs its own tests inside the Workers runtime.
export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts'],
  },
});
