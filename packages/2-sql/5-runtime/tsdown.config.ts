import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: {
    index: 'src/exports/index.ts',
    'test/utils': 'test/utils.ts',
  },
  external: ['@repo/test-utils', '@prisma/dev', 'pg'],
  // Keep manual exports to preserve stable root/subpath mapping.
  exports: { enabled: false },
});
