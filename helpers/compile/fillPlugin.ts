import type { Plugin } from 'esbuild'
import resolve from 'resolve'
import fs from 'fs'

const STREAM_LIB_BASE = 'readable-stream/lib/_stream_'

function load(path: string) {
  return fs.readFileSync(path, { encoding: 'utf8' })
}

function find(name: string) {
  return resolve.sync(name, { includeCoreModules: false })
}

type LoadResultMap = {
  [k in string]: { contents?: string; path?: string }
}

// https://v2.parceljs.org/features/node-emulation/
// https://github.com/Richienb/node-polyfill-webpack-plugin/blob/master/index.js
const fillPlugin = (loadResultMapOverrides: LoadResultMap): Plugin => ({
  name: 'fillPlugin',
  setup(build) {
    const _loadResultMap: LoadResultMap = {
      // enabled
      assert: { path: find('assert') },
      buffer: { path: find('buffer') },
      console: { path: find('console-browserify') },
      constants: { path: find('constants-browserify') },
      crypto: { path: find('crypto-browserify') },
      domain: { path: find('domain-browser') },
      events: { path: find('events') },
      fs: { path: find('memfs') },
      http: { path: find('stream-http') },
      https: { path: find('https-browserify') },
      inherits: { path: find('inherits') },
      os: { path: find('os-browserify/browser') },
      path: { path: find('path-browserify') },
      punycode: { path: find('punycode') },
      process: { path: find('process/browser') },
      querystring: { path: find('querystring-es3') },
      stream: { path: find('readable-stream') },
      _stream_duplex: { path: find(`${STREAM_LIB_BASE}duplex`) },
      _stream_passthrough: { path: find(`${STREAM_LIB_BASE}passthrough`) },
      _stream_readable: { path: find(`${STREAM_LIB_BASE}readable`) },
      _stream_transform: { path: find(`${STREAM_LIB_BASE}transform`) },
      _stream_writable: { path: find(`${STREAM_LIB_BASE}writable`) },
      string_decoder: { path: find('string_decoder') },
      sys: { path: find('util') },
      timers: { path: find('timers-browserify') },
      tty: { path: find('tty-browserify') },
      url: { path: find('url') },
      util: { path: find('util') },
      vm: { path: find('vm-browserify') },
      zlib: { path: find('browserify-zlib') },

      // disabled
      global: {},
      _inherits: {},
      _buffer_list: {},

      // no shim
      http2: { contents: '' },
      dns: { contents: '' },
      dgram: { contents: '' },
      cluster: { contents: '' },
      module: { contents: '' },
      net: { contents: '' },
      readline: { contents: '' },
      repl: { contents: '' },
      tls: { contents: '' },
      perf_hooks: { contents: '' },
      async_hooks: { contents: '' },
      child_process: { contents: '' },

      // overrides
      ...loadResultMapOverrides,
    }

    const names = Object.keys(_loadResultMap)
    const filter = new RegExp(`^${names.join('$|^')}$`)

    build.onResolve({ filter }, (args) => {
      const item = _loadResultMap[args.path]

      // if a path is provided, we just replace it
      if (item.path !== undefined) {
        return { path: item.path, sideEffects: false }
      }

      // if not, we defer action to the loaders cb
      return {
        path: args.path,
        namespace: 'fill-plugin',
        pluginData: args.importer,
        sideEffects: false,
      }
    })

    // we trigger the load cb for the created namespace
    build.onLoad({ filter: /.*/, namespace: 'fill-plugin' }, (args) => {
      // we display useful info if no shim has been found
      if (_loadResultMap[args.path].contents === undefined) {
        throw `no shim for "${args.path}" imported by "${args.pluginData}"`
      }

      return _loadResultMap[args.path] // inject contents
    })

    build.onEnd((result) => {
      result.warnings = []
    })
  },
})

export { fillPlugin }
