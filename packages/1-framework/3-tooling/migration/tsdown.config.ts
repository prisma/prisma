import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: {
    'exports/metadata': 'src/exports/metadata.ts',
    'exports/package': 'src/exports/package.ts',
    'exports/graph': 'src/exports/graph.ts',
    'exports/errors': 'src/exports/errors.ts',
    'exports/io': 'src/exports/io.ts',
    'exports/contract-snapshot-store': 'src/exports/contract-snapshot-store.ts',
    'exports/hash': 'src/exports/hash.ts',
    'exports/invariants': 'src/exports/invariants.ts',
    'exports/migration-graph': 'src/exports/migration-graph.ts',
    'exports/refs': 'src/exports/refs.ts',
    'exports/ref-resolution': 'src/exports/ref-resolution.ts',
    'exports/constants': 'src/exports/constants.ts',
    'exports/ledger-origin': 'src/exports/ledger-origin.ts',
    'exports/migration-ts': 'src/exports/migration-ts.ts',
    'exports/migration': 'src/exports/migration.ts',
    'exports/spaces': 'src/exports/spaces.ts',
    'exports/aggregate': 'src/exports/aggregate.ts',
  },
  exports: { enabled: false },
});
