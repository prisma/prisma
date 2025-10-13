import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['kysely', '@prisma/debug', '@refract/schema-parser'],
  minify: false,
  splitting: false,
  bundle: true,
})
