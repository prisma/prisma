import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: {
    pack: 'src/exports/pack.ts',
    runtime: 'src/exports/runtime.ts',
    contract: 'src/exports/contract.ts',
  },
  // Keep manual exports to preserve stable root/subpath mapping.
  exports: { enabled: false },
});
