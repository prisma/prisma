import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: {
    'exports/index': 'src/exports/index.ts',
    'domain-type-generation': 'src/domain-type-generation.ts',
    'type-expression-safety': 'src/type-expression-safety.ts',
    'test/utils': 'test/utils.ts',
  },
  // Keep manual exports to preserve stable root/subpath mapping.
  exports: { enabled: false },
});
