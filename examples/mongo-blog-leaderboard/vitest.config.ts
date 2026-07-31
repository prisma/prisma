import { defineConfig } from 'vitest/config';
import { mongoMemoryServerTimeoutMs } from './test/timeouts';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',
    maxWorkers: 1,
    isolate: false,
    testTimeout: mongoMemoryServerTimeoutMs,
    hookTimeout: mongoMemoryServerTimeoutMs,
  },
});
