import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: {
    'exports/index': 'src/exports/index.ts',
  },
  // Keep manual exports to preserve stable root mapping.
  exports: { enabled: false },
});
