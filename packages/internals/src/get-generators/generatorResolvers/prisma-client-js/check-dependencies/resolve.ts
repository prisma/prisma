import path from 'path'
import { default as _resolve } from 'resolve'

/**
 * Alternative to `require.resolve` that returns undefined instead of throwing.
 * It also enables preserving symlinks, which is not possible with the original
 * `require.resolve`. This variant will find the _entrypoint_ of a package.
 * @param id
 * @param options
 * @returns
 */
async function resolve(id: string, options: _resolve.AsyncOpts) {
  const _options = { preserveSymlinks: false, ...options }

  return new Promise((res) => {
    _resolve(id, _options, (e, v) => {
      if (e) res(undefined)

      res(v)
    })
  }) as Promise<string | undefined>
}

/**
 * Alternative to `require.resolve` that returns undefined instead of throwing.
 * It also enables preserving symlinks, which is not possible with the original
 * `require.resolve`. This variant will find the _root_ of a package.
 * @param id
 * @param options
 * @returns
 */
async function resolvePkg(id: string, options: _resolve.AsyncOpts) {
  const resolvedPath = await resolve(`${id}/package.json`, options)

  return resolvedPath && path.dirname(resolvedPath)
}

export { resolve, resolvePkg }
