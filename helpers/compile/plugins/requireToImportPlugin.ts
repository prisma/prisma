import { Plugin } from 'esbuild'

function escape(text: string) {
  return `^${text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`
}

/**
 * This plugin allows us to use require() in our code, but it will be transpiled
 * to import statements. This is useful for when you want to output ESM.
 * @param external
 * @returns
 */
export const requireToImportPlugin = (external: string[]): Plugin => ({
  name: 'requireToImportPlugin',
  setup(build) {
    const filter = new RegExp(external.map(escape).join('|'))
    build.onResolve({ filter: /.*/, namespace: 'requireToImportPlugin' }, (args) => ({
      path: args.path,
      external: true,
    }))
    build.onResolve({ filter }, (args) => ({
      path: args.path,
      namespace: 'requireToImportPlugin',
    }))
    build.onLoad({ filter: /.*/, namespace: 'requireToImportPlugin' }, (args) => ({
      contents: `export { default } from "node:${args.path}";export * from "node:${args.path}";`,
    }))
  },
})
