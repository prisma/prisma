import resolveFrom from 'resolve-from'
import pkgUp from 'pkg-up'
import path from 'path'
import Module from 'module'

export function resolvePkg(cwd: string, moduleId: string): string | null {
  const paths = (Module as any)._nodeModulePaths(cwd)
  let modulePath
  try {
    modulePath = require.resolve(moduleId, {
      paths,
    })
  } catch (e) {
    // console.error(e)
  }
  if (!modulePath) {
    modulePath = resolveFrom.silent(cwd, moduleId)
  }
  if (modulePath) {
    const pkgPath = pkgUp.sync({ cwd: path.dirname(modulePath) })
    if (pkgPath) {
      return path.dirname(pkgPath)
    }
  }
  return null
}
