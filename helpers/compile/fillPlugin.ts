import * as esbuild from 'esbuild'
import resolve from 'resolve'
import path from 'path'
import crypto from 'crypto'

const STREAM_LIB = 'readable-stream/lib/_stream_'

type LoadCache = { [K in string]: Promise<string> }

const loader = (cache: LoadCache) => async (module: string) => {
  if (cache[module]) return cache[module]

  const modulePath = resolve.sync(module, { includeCoreModules: false })
  const filename = `${crypto.randomBytes(16).toString('hex')}.js`
  const outdir = path.join(path.sep, 'tmp', 'esbuild')

  return (cache[module] = (async () => {
    await esbuild.build({
      format: 'cjs',
      platform: 'node',
      entryPoints: [path.basename(modulePath)],
      outfile: path.join(outdir, filename),
      absWorkingDir: path.dirname(modulePath),
      bundle: true,
      minify: true,
    })

    return path.join(outdir, filename)
  })())
}

type Fillers = {
  [k in string]: {
    contents?: string
    path?: string
    define?: string
    inject?: string
  }
}

// https://v2.parceljs.org/features/node-emulation/
// https://github.com/Richienb/node-polyfill-webpack-plugin/blob/master/index.js
const fillPlugin = (
  fillerOverrides: Fillers,
  cache: LoadCache = {},
): esbuild.Plugin => ({
  name: 'fillPlugin',
  async setup(build) {
    const load = loader(cache)
    const options = build.initialOptions
    const fillers: Fillers = {
      // enabled
      assert: { path: await load('assert-browserify') },
      buffer: { path: await load('buffer') },
      constants: { path: await load('constants-browserify') },
      crypto: { path: await load('crypto-browserify') },
      domain: { path: await load('domain-browser') },
      events: { path: await load('eventemitter3') },
      http: { path: await load('stream-http') },
      https: { path: await load('https-browserify') },
      inherits: { path: await load('inherits') },
      os: { path: await load('os-browserify/browser') },
      path: { path: await load('path-browserify') },
      punycode: { path: await load('punycode') },
      querystring: { path: await load('querystring-es3') },
      stream: { path: await load('stream-browserify') },
      _stream_duplex: { path: await load(`${STREAM_LIB}duplex`) },
      _stream_passthrough: { path: await load(`${STREAM_LIB}passthrough`) },
      _stream_readable: { path: await load(`${STREAM_LIB}readable`) },
      _stream_transform: { path: await load(`${STREAM_LIB}transform`) },
      _stream_writable: { path: await load(`${STREAM_LIB}writable`) },
      string_decoder: { path: await load('string_decoder') },
      sys: { path: await load('util') },
      timers: { path: await load('timers-browserify') },
      tty: { path: await load('tty-browserify') },
      url: { path: await load('url') },
      util: { path: await load('util') },
      vm: { path: await load('vm-browserify') },
      zlib: { path: await load('browserify-zlib') },

      // no shims
      fs: { contents: '' },
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

      // globals
      Buffer: { inject: await load('buffer') },
      process: {
        path: await load('process/browser'),
        inject: await load('process/browser'),
      },

      // not needed
      // console: {
      //   path: await load('console-browserify'),
      //   inject: await load('console-browserify'),
      // },
      // __dirname: { define: '/' },
      // __filename: { define: '/index.js' },
      // clearImmediate: { define: '' },
      // clearInterval: { define: '' },

      // overrides
      ...fillerOverrides,
    }

    const fillerNames = Object.keys(fillers)
    const filter = new RegExp(`^${fillerNames.join('$|^')}$`)

    options.define = options.define ?? {}
    options.inject = options.inject ?? []
    for (const fillerName of fillerNames) {
      const filler = fillers[fillerName]
      if (filler.define) options.define[fillerName] = filler.define
      if (filler.inject) options.inject.push(filler.inject)
    }

    build.onResolve({ filter }, (args) => {
      // removes trailing slashes in imports paths
      const path = args.path.replace(/\/$/, '')
      const item = fillers[path]

      // if a path is provided, we just replace it
      if (item.path !== undefined) {
        return { path: item.path }
      }

      // if not, we defer action to the loaders cb
      return {
        path: path,
        namespace: 'fill-plugin',
        pluginData: args.importer,
      }
    })

    // we trigger the load cb for the created namespace
    build.onLoad({ filter: /.*/, namespace: 'fill-plugin' }, (args) => {
      // we display useful info if no shim has been found
      if (fillers[args.path].contents === undefined) {
        throw `no shim for "${args.path}" imported by "${args.pluginData}"`
      }

      return fillers[args.path] // inject the contents
    })
  },
})

export { fillPlugin }
