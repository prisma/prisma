import path from 'node:path'

import { build, type BuildOptions } from '../../../helpers/compile/build'
import { fillPlugin } from '../../../helpers/compile/plugins/fill-plugin/fillPlugin'

const buildOptions: BuildOptions = {
  name: 'default',
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index',
  bundle: true,
  minify: true,
  emitTypes: true,
  conditions: ['workerd', 'node'],
  plugins: [
    fillPlugin({
      fillerOverrides: {
        './native': { contents: '' },
        assert: { contents: 'export * from "node:assert"' },
        async_hooks: { contents: 'export * from "node:async_hooks"' },
        buffer: { contents: 'export * from "node:buffer"' },
        Buffer: { globals: path.join(__dirname, 'buffer.ts') },
        crypto: { contents: 'export * from "node:crypto"' },
        diagnostics_channel: { contents: 'export * from "node:diagnostics_channel"' },
        events: { contents: 'export * from "node:events"' },
        path: { contents: 'export * from "node:path"' },
        stream: { contents: 'export * from "node:stream"' },
        string_decoder: { contents: 'export * from "node:string_decoder"' },
        util: { contents: 'export * from "node:util"' },
      },
    }),
    {
      name: 'forceNodePrefix', // counters a side-effect of fillPlugin
      setup(build) {
        build.onResolve({ filter: /^node:/ }, () => ({ external: true }))
      },
    },
  ],
}

void build([
  { ...buildOptions, format: 'cjs', outExtension: { '.js': '.js' } },
  { ...buildOptions, format: 'esm', outExtension: { '.js': '.mjs' } },
])
