import { build } from 'esbuild'
import refract from 'unplugin-refract/esbuild'

const isProduction = process.env.NODE_ENV === 'production'

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  format: 'esm',
  target: 'es2020',
  sourcemap: true,
  minify: isProduction,
  plugins: [
    refract({
      schema: '../schema.prisma',
      debug: !isProduction,
      production: {
        optimize: isProduction,
        cache: true,
        sourceMaps: true,
        failOnError: isProduction,
      },
    }),
  ],
  external: ['@refract/client'],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
})
  .then(() => {
    console.log('⚡ ESBuild completed successfully!')
  })
  .catch((error) => {
    console.error('❌ ESBuild failed:', error)
    process.exit(1)
  })
