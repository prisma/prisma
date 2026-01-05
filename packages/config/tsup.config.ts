import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: {
    resolve: true,
    // Skip resolution of peer dependencies for type generation
    compilerOptions: {
      skipLibCheck: true,
      skipDefaultLibCheck: true,
    },
  },
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  target: 'node18',
  platform: 'node',
  external: [
    // Peer dependencies - not bundled
    'pg',
    'mysql2',
    'better-sqlite3',
    'kysely-d1',
  ],
})
