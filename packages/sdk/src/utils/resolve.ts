import fs from 'fs'
import path from 'path'

interface ResolveOptions {
  basedir?: string
  preserveSymlinks?: boolean
}

const realpathFS = fs.realpath && typeof fs.realpath.native === 'function' ? fs.realpath.native : fs.realpath

async function resolve(id: string, options: ResolveOptions) {
  const { basedir } = options
  let { preserveSymlinks } = options

  if (preserveSymlinks === undefined) {
    preserveSymlinks = true
  }

  return new Promise<string | undefined>((resolve) => {
    try {
      const res = require.resolve(id, { paths: basedir ? [basedir] : undefined })

      if (res && options.preserveSymlinks === false) {
        realpathFS(res, (err, resolvedPath) => {
          resolve(err ? undefined : resolvedPath)
        })
      } else {
        resolve(res)
      }
    } catch (error) {
      resolve(undefined)
    }
  })
}

async function resolvePkg(id: string, options: ResolveOptions) {
  const resolvedPath = await resolve(`${id}/package.json`, options)

  return resolvedPath && path.dirname(resolvedPath)
}

export { resolve, resolvePkg }
