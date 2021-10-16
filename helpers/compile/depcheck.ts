import * as esbuild from 'esbuild'
import glob from 'globby'
import path from 'path'

// packages that aren't detected but used
// TODO: these could be scoped at the root
const unusedIgnore = [
  // these are our dev dependencies
  /@types\/.*?/,
  /@typescript-eslint.*?/,
  /eslint.*?/,
  'esbuild',
  'husky',
  'is-ci',
  'lint-staged',
  'prettier',
  'typescript',
  'ts-node',
  'ts-jest',
  'jest',

  // these are missing 3rd party deps
  'spdx-exceptions',
  'spdx-license-ids',

  // type-only, so it is not detected
  'ts-toolbelt',
]

// packages that aren't missing but are detected
const missingIgnore = ['.prisma', '@prisma/client']

// native nodejs imports so that we can filter out
const nativeDependencies = new Set(
  Object.keys((process as any).binding('natives')),
)

/**
 * Checks for unused and missing dependencies
 */
const unusedPlugin: esbuild.Plugin = {
  name: 'unusedPlugin',
  setup(build) {
    // we load the package.json of the project do do our analysis
    const pkgJsonPath = path.join(process.cwd(), 'package.json')
    const pkgContents = require(pkgJsonPath) as object
    const regDependencies = Object.keys(pkgContents['dependencies'] ?? {})
    const devDependencies = Object.keys(pkgContents['devDependencies'] ?? {})
    const dependencies = new Set([...regDependencies, ...devDependencies])

    // we prepare to collect dependencies that are only packages
    const collectedDependencies = new Set<string>()
    const onlyPackages = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/
    build.onResolve({ filter: onlyPackages }, (args) => {
      // we limit this search to the parent folder, don't go back
      if (args.importer.includes(process.cwd())) {
        // handle cases where there is extra path @org/pkg/folder
        if (args.path[0] == '@') {
          // we have a package that lives in org's scope, trim it
          const [org, pkg] = args.path.split('/')
          collectedDependencies.add(`${org}/${pkg}`)
        } else {
          // we have a regular package without scope, we trim it
          const [pkg] = args.path.split('/')
          collectedDependencies.add(pkg)
        }
      }

      return { external: true } // we don't care for the bundling
    })

    build.onEnd(() => {
      // we take all the dependencies that aren't collected and are native
      const unusedDependencies = [...dependencies].filter((dep) => {
        return !collectedDependencies.has(dep) || nativeDependencies.has(dep)
      })

      // we take all the collected deps that aren't deps and aren't native
      const missingDependencies = [...collectedDependencies].filter((dep) => {
        return !dependencies.has(dep) && !nativeDependencies.has(dep)
      })

      // we exclude the deps that match our unusedIgnore patterns
      const filteredUnusedDeps = unusedDependencies.filter((dep) => {
        return !unusedIgnore.some((pattern) => dep.match(pattern))
      })

      // we exclude the deps that match our unusedIgnore patterns
      const filteredMissingDeps = missingDependencies.filter((dep) => {
        return !missingIgnore.some((pattern) => dep.match(pattern))
      })

      console.warn('unusedDependencies', filteredUnusedDeps)
      console.warn('missingDependencies', filteredMissingDeps)
    })
  },
}

void esbuild
  .build({
    entryPoints: glob.sync('**/*.{j,t}s', {
      ignore: ['**/packages/**/*', '**/*.d.ts'],
      gitignore: true,
    }),
    logLevel: 'silent', // there will be errors
    bundle: true, // we bundle to get everything
    write: false, // no need to write for analysis
    outdir: 'out',
    plugins: [unusedPlugin],
  })
  .catch(() => {})
