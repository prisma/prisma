import crypto from 'crypto'
import * as esbuild from 'esbuild'
import os from 'os'
import path from 'path'
import resolve from 'resolve'

type LoadCache = { [K in string]: string }

type Fillers = {
  [k in string]: {
    contents?: string
    path?: string
    define?: string
    inject?: string
  }
}

/**
 * Bundle a polyfill with all its dependencies. We use paths to files in /tmp
 * instead of direct contents so that esbuild can include things once only.
 * @param cache to serve from
 * @param module to be compiled
 * @returns the path to the bundle
 */
const loader = (cache: LoadCache) => (module: string) => {
  if (cache[module]) return cache[module]

  const modulePkg = `${module}/package.json`
  const resolveOpt = { includeCoreModules: false }
  const modulePath = path.dirname(resolve.sync(modulePkg, resolveOpt))
  const filename = `${module}${crypto.randomBytes(4).toString('hex')}.js`
  const outfile = path.join(os.tmpdir(), 'esbuild', filename)

  esbuild.buildSync({
    format: 'cjs',
    platform: 'node',
    outfile: outfile,
    entryPoints: [modulePath],
    absWorkingDir: modulePath,
    mainFields: ['browser', 'main'],
    bundle: true,
    minify: true,
  })

  return (cache[module] = outfile)
}

/**
 * Creates a RegExp for filtering injections
 * @param fillers to be filtered
 * @returns
 */
function createImportFilter(fillers: Fillers) {
  const fillerNames = Object.keys(fillers)

  return new RegExp(`^${fillerNames.join('\\/?$|^')}\\/?$`)
}

/**
 * Looks through the fillers and applies their `define` or `inject` (if they
 * have such a field to the esbuild `options` that we passed.
 * @param options from esbuild
 * @param fillers to be scanned
 */
function setInjectionsAndDefinitions(fillers: Fillers, options: esbuild.BuildOptions) {
  const fillerNames = Object.keys(fillers)

  // we make sure that it is not empty
  options.define = options.define ?? {}
  options.inject = options.inject ?? []

  // we scan through fillers and apply
  for (const fillerName of fillerNames) {
    const filler = fillers[fillerName]

    if (filler.define) {
      options.define[fillerName] = filler.define
    }

    if (filler.inject) {
      options.inject.push(filler.inject)
    }
  }
}

/**
 * Handles the resolution step where esbuild resolves the imports before
 * bundling them. This allows us to inject a filler via its `path` if it was
 * provided. If not, we proceed to the next `onLoad` step.
 * @param fillers to use the path from
 * @param args from esbuild
 * @returns
 */
function onResolve(fillers: Fillers, args: esbuild.OnResolveArgs): esbuild.OnResolveResult {
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
}

/**
 * Handles the load step where esbuild loads the contents of the imports before
 * bundling them. This allows us to inject a filler via its `contents` if it was
 * provided. If not, the polyfill is empty and we display an error.
 * @param fillers to use the contents from
 * @param args from esbuild
 */
function onLoad(fillers: Fillers, args: esbuild.OnLoadArgs): esbuild.OnLoadResult {
  // display useful info if no shim has been found
  if (fillers[args.path].contents === undefined) {
    throw `no shim for "${args.path}" imported by "${args.pluginData}"`
  }

  return fillers[args.path] // inject the contents
}

const load = loader({})

/**
 * Provides a simple way to use esbuild's injection capabilities while providing
 * sensible defaults for node polyfills.
 * @see https://v2.parceljs.org/features/node-emulation/
 * @see https://github.com/Richienb/node-polyfill-webpack-plugin/blob/master/index.js
 * @param fillerOverrides override default fillers
 * @returns
 */
const fillPlugin = (
  fillerOverrides: Fillers,
  triggerPredicate: (options: esbuild.BuildOptions) => boolean = () => true,
): esbuild.Plugin => ({
  name: 'fillPlugin',
  setup(build) {
    // in some cases, we just want to run this once (eg. on esm)
    if (triggerPredicate(build.initialOptions) === false) return

    const fillers: Fillers = {
      // enabled
      // assert: { path: load('assert-browserify') },
      buffer: { path: load('buffer') },
      // constants: { path: load('constants-browserify') },
      // crypto: { path: load('crypto-browserify') },
      // domain: { path: load('domain-browser') },
      events: { path: load('eventemitter3') },
      // http: { path: load('stream-http') },
      // https: { path: load('https-browserify') },
      // inherits: { path: load('inherits') },
      // os: { path: load('os-browserify') },
      path: { path: load('path-browserify') },
      // punycode: { path: load('punycode') },
      // querystring: { path: load('querystring-es3') },
      // stream: { path: load('readable-stream') },
      // string_decoder: { path: load('string_decoder') },
      // sys: { path: load('util') },
      // timers: { path: load('timers-browserify') },
      tty: { path: load('tty-browserify') },
      // url: { path: load('url') },
      util: { path: load('util') },
      // vm: { path: load('vm-browserify') },
      // zlib: { path: load('browserify-zlib') },

      // no shims
      fs: { path: path.join(__dirname, 'fillers', 'fs.ts') },
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
      Buffer: {
        inject: path.join(__dirname, 'fillers', 'buffer.ts'),
      },
      process: {
        inject: path.join(__dirname, 'fillers', 'process.ts'),
      },

      // not needed
      // global: {
      //   define: '{}',
      // },
      // globalThis: {
      //   define: '{}',
      // },
      // console: { },
      // __dirname: { },
      // __filename: { },
      // clearImmediate: { },
      // clearInterval: { },

      // overrides
      ...fillerOverrides,
    }

    // our first step is to update options with basic injections
    setInjectionsAndDefinitions(fillers, build.initialOptions)

    // allows us to change the path of a filtered import by another
    build.onResolve({ filter: createImportFilter(fillers) }, (args) => {
      return onResolve(fillers, args)
    })

    // if no path was provided it defers to virtual nsp `fill-plugin`
    build.onLoad({ filter: /.*/, namespace: 'fill-plugin' }, (args) => {
      return onLoad(fillers, args)
    })
  },
})

export { fillPlugin }
