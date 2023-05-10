import crypto from 'crypto'
import * as esbuild from 'esbuild'
import os from 'os'
import path from 'path'
import resolve from 'resolve'

export type LoadCache = { [K in string]: string }

export type Fillers =
  | {
      [k in string]: {
        contents?: string
        path?: string
        define?: string
        inject?: string

        import?: never
        export?: never
      }
    }
  | {
      $?: {
        import?: string[]
        export?: string[]

        contents?: never
        path?: never
        define?: never
        inject?: never
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
 * Looks through the fillers and applies their `import` or `export`. This is
 * used to inject import and export statements mostly, but can contain any code.
 * @param options from esbuild
 * @param fillers to be scanned
 */
function setCodeBannerAndFooter(fillers: Fillers, options: esbuild.BuildOptions) {
  if (fillers?.$?.import !== undefined) {
    if (options.banner === undefined) {
      options.banner = {}
    }

    if (options.banner.js === undefined) {
      options.banner.js = ''
    }

    const content = fillers.$.import.join('\n')
    options.banner.js = options.banner.js.concat(content)
  }

  if (fillers?.$?.export !== undefined) {
    if (options.footer === undefined) {
      options.footer = {}
    }

    if (options.footer.js === undefined) {
      options.footer.js = ''
    }

    const content = fillers.$.export.join('\n')
    options.footer.js = options.footer.js.concat(content)
  }

  delete fillers.$ // remove the special $ filler
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

export const load = loader({})

/**
 * Provides a simple way to use esbuild's injection capabilities while providing
 * sensible defaults for node polyfills.
 * @see https://v2.parceljs.org/features/node-emulation/
 * @see https://github.com/Richienb/node-polyfill-webpack-plugin/blob/master/index.js
 * @param fillerPreset override default fillers
 * @returns
 */
const fillPlugin = (
  fillerPreset: Fillers,
  triggerPredicate: (options: esbuild.BuildOptions) => boolean = () => true,
): esbuild.Plugin => ({
  name: 'fillPlugin',
  setup(build) {
    // do a deep clone of the preset to avoid mutation
    fillerPreset = JSON.parse(JSON.stringify(fillerPreset))

    // in some cases, we just want to run this once (eg. on esm)
    if (triggerPredicate(build.initialOptions) === false) return

    // our first steps is to update options with basic injections
    setCodeBannerAndFooter(fillerPreset, build.initialOptions)
    setInjectionsAndDefinitions(fillerPreset, build.initialOptions)

    // allows us to change the path of a filtered import by another
    build.onResolve({ filter: createImportFilter(fillerPreset) }, (args) => {
      return onResolve(fillerPreset, args)
    })

    // if no path was provided it defers to virtual nsp `fill-plugin`
    build.onLoad({ filter: /.*/, namespace: 'fill-plugin' }, (args) => {
      return onLoad(fillerPreset, args)
    })
  },
})

export { fillPlugin }
