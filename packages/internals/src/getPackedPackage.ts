import fs from 'fs'
import { copySync } from 'fs-extra'
import path from 'path'
import readPkgUp from 'read-pkg-up'
import rimraf from 'rimraf'
import tempy from 'tempy'
import { promisify } from 'util'

import { resolvePkg } from './utils/resolve'

// why not directly use Sindre's 'del'? Because it's not ncc-able :/
const del = promisify(rimraf)
const readdir = promisify(fs.readdir)
const rename = promisify(fs.rename)

export async function getPackedPackage(name: string, target?: string, packageDir?: string): Promise<string | void> {
  packageDir =
    packageDir || (await resolvePkg(name, { basedir: process.cwd() })) || (await resolvePkg(name, { basedir: target }))

  if (!packageDir) {
    const pkg = readPkgUp.sync({
      cwd: target,
    })
    if (pkg && pkg.packageJson.name === name) {
      packageDir = path.dirname(pkg.path)
    }
  }

  if (!packageDir && fs.existsSync(path.join(process.cwd(), 'package.json'))) {
    packageDir = process.cwd()
  }

  if (!packageDir) {
    throw new Error(`Error in getPackage: Could not resolve package ${name} from ${process.cwd()} target ${target}`)
  }

  const tmpDir = target ?? tempy.directory() // thanks Sindre

  const pkgJson = require(`${packageDir}/package.json`)

  // we compute the paths of the files that would get npm published
  const pkgFiles = (pkgJson.files ?? []).concat(['package.json']).map((file: string) => path.join(packageDir!, file))

  // we copy each file that we found in pkg to a new destination
  for (const file of [...pkgFiles]) {
    const dest = path.join(tmpDir, path.basename(file))
    copySync(file, dest, { recursive: true, overwrite: true })
  }

  return path.join(tmpDir)
}
