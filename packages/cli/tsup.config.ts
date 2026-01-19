import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts'],
  format: ['esm'],
  target: 'node20',
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    'chalk',
    'commander',
    'ora',
    'prompts',
    'zod',
    '@ork-orm/config',
    '@ork-orm/schema-parser',
    '@ork-orm/migrate',
    '@ork-orm/client',
    'kysely',
    'pg',
    'mysql2',
    'better-sqlite3',
    'kysely-d1',
  ],
  minify: false,
  splitting: false,
  bundle: true,
})
