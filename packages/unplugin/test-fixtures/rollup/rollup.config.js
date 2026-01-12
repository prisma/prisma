import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import ork from 'unplugin-ork/rollup'

export default {
  input: 'src/main.ts',
  output: {
    file: 'dist/bundle.js',
    format: 'esm',
    sourcemap: true,
  },
  plugins: [
    ork({
      schema: '../schema.prisma',
      debug: true,
      production: {
        optimize: process.env.NODE_ENV === 'production',
        cache: true,
        sourceMaps: true,
      },
    }),
    resolve({
      preferBuiltins: true,
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: true,
    }),
  ],
  external: ['@ork/client'],
}
