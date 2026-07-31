import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: {
    'exports/index': 'src/exports/index.ts',
  },
  exports: { enabled: false },
});
