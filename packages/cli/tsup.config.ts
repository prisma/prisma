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
    '@refract/config',
    '@refract/schema-parser',
    '@refract/migrate',
    '@refract/client',
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
