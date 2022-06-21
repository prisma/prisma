import copy from '@timsuchanek/copy'
import execa from 'execa'
import fs from 'fs'
import makeDir from 'make-dir'
import path from 'path'
import readPkgUp from 'read-pkg-up'
import rimraf from 'rimraf'
import { quote } from 'shell-quote'
import tar from 'tar'
import tempy from 'tempy'
import { promisify } from 'util'

import { hasYarn } from './utils/hasYarn'
import { resolvePkg } from './utils/resolve'

// why not directly use Sindre's 'del'? Because it's not ncc-able :/
const del = promisify(rimraf)
const readdir = promisify(fs.readdir)
const rename = promisify(fs.rename)

export async function getPackedPackage(name: string, target?: string, packageDir?: string): Promise<string | void> {
  packageDir =
    packageDir || (await resolvePkg(name, { basedir: process.cwd() })) || (await resolvePkg(name, { basedir: target }))

  if (!packageDir) {
    const pkg = await readPkgUp({
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
    throw new Error(`Error in getPackage: Could not resolve package ${name} from ${__dirname}`)
  }
  const tmpDir = tempy.directory() // thanks Sindre
  const archivePath = path.join(tmpDir, `package.tgz`)

  // Check if yarn is available.
  const isYarn = await hasYarn(packageDir)

  const packCmd = isYarn ? ['yarn', 'pack', '-f', archivePath] : ['npm', 'pack', packageDir]

  // shell-quote args
  const escapedCmd = quote(packCmd)

  // pack into a .tgz in a tmp dir
  await execa.command(escapedCmd, {
    shell: true,
    cwd: isYarn ? packageDir : tmpDir, // for npm pack it outputs a file to the cwd
  })

  if (!isYarn) {
    // since npm pack does not have option to specify a filename we change it here
    // find single tgz in temp folder
    const filename = (await readdir(tmpDir))[0]
    // rename it to match expected filename
    await rename(path.join(tmpDir, filename), archivePath)
  }

  // extract and delete the archive
  await tar.extract({
    cwd: tmpDir,
    file: archivePath,
  })

  await del(archivePath)

  /**
   * Only if a target is provided, perform the copy
   */
  if (target) {
    // make target dir
    await makeDir(target)

    // copy stuff over
    await copy({
      from: path.join(tmpDir, 'package'), // when using yarn pack and extracting it, it includes a folder called "package"
      to: target,
      recursive: true,
      parallelJobs: 20,
      overwrite: true,
    })

    // delete tmp dir
    await del(tmpDir)
  }

  return path.join(tmpDir, 'package')
}
