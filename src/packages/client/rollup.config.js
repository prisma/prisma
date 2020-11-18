import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs'
import dts from 'rollup-plugin-dts'

const config = [
  {
    input: './runtime-dist/commonjs/index.d.ts',
    output: [{ file: 'runtime/commonjs/index.d.ts', format: 'es' }],
    plugins: [
      dts({
        respectExternal: true,
      }),
    ],
  },
  {
    input: './runtime-dist/esm/index.js',
    output: [{ file: 'runtime/esm/index.js', format: 'es' }],
    plugins: [json(), resolve({ preferBuiltins: true }), commonjs()]
  },
]

export default config
