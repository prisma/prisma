import fs from 'fs'
import packlist from 'npm-packlist'
import path from 'path'
import readPkgUp from 'read-pkg-up'
import tempy from 'tempy'

import { resolvePkg } from './get-generators/generatorResolvers/prisma-client-js/check-dependencies/resolve'

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

  const pkgFiles = await packlist({ path: packageDir })

  // we compute the paths of the files that would get npm published

  // we copy each file that we found in pkg to a new destination
  for (const file of pkgFiles) {
    const src = path.join(packageDir, file)
    const dest = path.join(tmpDir, file)

    await fs.promises.mkdir(path.dirname(dest), { recursive: true })
    await fs.promises.copyFile(src, dest)
  }

  return path.join(tmpDir)
}
