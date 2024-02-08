import * as esbuild from 'esbuild'
import path from 'path'

type Fillers = {
  [k in string]: {
    imports?: string | { path: string; external: boolean }
    globals?: string
    contents?: string
    define?: string
  }
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

    if (filler.globals) {
      options.inject.push(filler.globals)
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
  if (item.imports !== undefined) {
    if (typeof item.imports === 'string') {
      return { path: item.imports }
    }
    return item.imports
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
      events: { imports: path.join(__dirname, 'fillers', 'events.ts') },
      path: { imports: path.join(__dirname, 'fillers', 'path.ts') },
      tty: { imports: path.join(__dirname, 'fillers', 'tty.ts') },
      util: { imports: path.join(__dirname, 'fillers', 'util.ts') },

      // disabled
      constants: { contents: '' },
      crypto: { contents: '' },
      domain: { contents: '' },
      http: { contents: '' },
      https: { contents: '' },
      inherits: { contents: '' },
      os: { contents: '' },
      punycode: { contents: '' },
      querystring: { contents: '' },
      stream: { contents: '' },
      string_decoder: { contents: '' },
      sys: { contents: '' },
      timers: { contents: '' },
      url: { contents: '' },
      vm: { contents: '' },
      zlib: { contents: '' },

      // no shims
      async_hooks: { contents: '' },
      child_process: { contents: '' },
      cluster: { contents: '' },
      dns: { contents: '' },
      dgram: { contents: '' },
      fs: { imports: path.join(__dirname, 'fillers', 'fs.ts') },
      http2: { contents: '' },
      module: { contents: '' },
      net: { contents: '' },
      perf_hooks: { imports: path.join(__dirname, 'fillers', 'perf_hooks.ts') },
      readline: { contents: '' },
      repl: { contents: '' },
      tls: { contents: '' },

      // globals
      Buffer: {
        globals: path.join(__dirname, 'fillers', 'buffer.ts'),
      },
      process: {
        globals: path.join(__dirname, 'fillers', 'process.ts'),
        imports: path.join(__dirname, 'fillers', 'process.ts'),
      },
      performance: {
        globals: path.join(__dirname, 'fillers', 'perf_hooks.ts'),
      },
      __dirname: { define: '"/"' },
      __filename: { define: '"index.js"' },

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
