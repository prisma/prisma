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
    input: './runtime-dist/index-browser.d.ts',
    output: [{ file: 'runtime/index-browser.d.ts', format: 'es' }],
    plugins: [
      dts({
        respectExternal: true,
      }),
    ],
  },
]

export default config
