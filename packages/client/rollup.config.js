import dts from 'rollup-plugin-dts'

const config = [
  {
    input: 'declaration/index.d.ts',
    output: [{ file: 'runtime/index.d.ts', format: 'es' }],
    plugins: [
      dts({
        respectExternal: true,
      }),
    ],
  },
  {
    input: 'declaration/index-browser.d.ts',
    output: [{ file: 'runtime/index-browser.d.ts', format: 'es' }],
    plugins: [
      dts({
        respectExternal: true,
      }),
    ],
  },
]

export default config
