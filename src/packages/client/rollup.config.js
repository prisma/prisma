import dts from 'rollup-plugin-dts'

const config = [
  {
    input: './runtime-dist/index.d.ts',
    output: [{ file: 'runtime/index.d.ts', format: 'es' }],
    plugins: [
      dts({
        respectExternal: true,
      }),
    ],
  },
]

export default config
