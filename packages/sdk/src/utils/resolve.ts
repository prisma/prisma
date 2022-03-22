import path from 'path'
import { default as _resolve } from 'resolve'

async function resolve(id: string, options: _resolve.AsyncOpts) {
  const _options = { preserveSymlinks: false, ...options }

  return new Promise((res) => {
    _resolve(id, _options, (e, v) => {
      if (e) res(undefined)

      res(v)
    })
  }) as Promise<string | undefined>
}

async function resolvePkg(id: string, options: _resolve.AsyncOpts) {
  const resolvedPath = await resolve(`${id}/package.json`, options)

  return resolvedPath && path.dirname(resolvedPath)
}

export { resolve, resolvePkg }
