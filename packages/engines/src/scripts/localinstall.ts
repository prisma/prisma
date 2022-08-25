import { BinaryType, getCacheDir } from '@prisma/fetch-engine'
import { enginesOverride } from '@prisma/fetch-engine/package.json'
import { getPlatform } from '@prisma/get-platform'
import execa from 'execa'
import fs from 'fs'
import path from 'path'

const baseDir = path.join(__dirname, '..', '..')

async function main() {
  const binaryTarget = await getPlatform()
  const cacheDir = (await getCacheDir('master', '_local_', binaryTarget))!
  const branch = enginesOverride?.['branch'] as string | undefined
  let folder = enginesOverride?.['folder'] as string | undefined

  const engineCachePaths = {
    [BinaryType.queryEngine]: path.join(cacheDir, BinaryType.queryEngine),
    [BinaryType.libqueryEngine]: path.join(cacheDir, BinaryType.libqueryEngine),
    [BinaryType.migrationEngine]: path.join(cacheDir, BinaryType.migrationEngine),
    [BinaryType.introspectionEngine]: path.join(cacheDir, BinaryType.introspectionEngine),
    [BinaryType.prismaFmt]: path.join(cacheDir, BinaryType.prismaFmt),
  }

  if (branch !== undefined) {
    const enginesRepoUri = 'git@github.com:prisma/prisma-engines.git'
    const enginesRepoDir = path.join(baseDir, 'dist', 'prisma-engines')

    // we try to get the current branch name, it fails if repo isn't cloned
    const currentBranch = await execa('git', ['branch', '--show-current'], {
      cwd: enginesRepoDir,
    }).catch(() => ({ failed: true, stdout: '' }))

    // if the branch isn't the one we wanted or the repo hasn't been cloned
    if (currentBranch.failed === true || currentBranch.stdout !== branch) {
      await fs.promises.rm(enginesRepoDir, { recursive: true, force: true })

      await execa('git', ['clone', enginesRepoUri, '--depth', '1', '--branch', branch], {
        cwd: path.join(baseDir, 'dist'),
        stdio: 'inherit',
      })
    }

    // we make sure that we always have the latest changes from the branch
    await execa('git', ['pull', 'origin', branch], {
      cwd: enginesRepoDir,
      stdio: 'inherit',
    })

    // we use cargo to build all the engines for the branch we checked out
    await execa('cargo', ['build', '--release'], {
      cwd: enginesRepoDir,
      stdio: 'inherit',
    })

    folder = path.join(enginesRepoDir, 'target', 'release')
  }

  // we copy the engines from the compiled output folder to the cache dir
  if (folder !== undefined) {
    folder = path.isAbsolute(folder) ? folder : path.join(baseDir, folder)
    const libExt = binaryTarget.includes('windows') ? '.dll' : binaryTarget.includes('darwin') ? '.dylib' : '.so'
    const binExt = binaryTarget.includes('windows') ? '.exe' : ''

    const engineOutputPaths = {
      [BinaryType.libqueryEngine]: path.join(folder, 'libquery_engine'.concat(libExt)),
      [BinaryType.queryEngine]: path.join(folder, BinaryType.queryEngine.concat(binExt)),
      [BinaryType.migrationEngine]: path.join(folder, BinaryType.migrationEngine.concat(binExt)),
      [BinaryType.introspectionEngine]: path.join(folder, BinaryType.introspectionEngine.concat(binExt)),
      [BinaryType.prismaFmt]: path.join(folder, BinaryType.prismaFmt.concat(binExt)),
    }

    for (const [binaryType, outputPath] of Object.entries(engineOutputPaths)) {
      await fs.promises.copyFile(outputPath, engineCachePaths[binaryType])
    }
  }
}

main().catch((e) => {
  console.log(e.message)
  process.exit(1)
})
