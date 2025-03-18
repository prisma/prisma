import path from 'path'
import resolve from 'resolve'

/**
 * Alternative to `require.resolve` that returns undefined instead of throwing.
 * It also enables preserving symlinks, which is not possible with the original
 * `require.resolve`. This variant will find the _entrypoint_ of a package.
 */
async function resolveOrUndefined(id: string, options: resolve.AsyncOpts) {
  const _options = { preserveSymlinks: false, ...options }

  return new Promise((res) => {
    resolve(id, _options, (e, v) => {
      if (e) res(undefined)

      res(v)
    })
  }) as Promise<string | undefined>
}

/**
 * Alternative to `require.resolve` that returns undefined instead of throwing.
 * It also enables preserving symlinks, which is not possible with the original
 * `require.resolve`. This variant will find the _root_ of a package.
 */
export async function resolvePkg(id: string, options: resolve.AsyncOpts) {
  const resolvedPath = await resolveOrUndefined(`${id}/package.json`, options)

  return resolvedPath && path.dirname(resolvedPath)
}
