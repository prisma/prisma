import { BinaryType, getCacheDir } from '@prisma/fetch-engine'
import { getPlatform } from '@prisma/get-platform'
import execa from 'execa'
import fs from 'fs'
import path from 'path'

const baseDir = path.join(__dirname, '..', '..')
const pkgJsonPath = path.join(baseDir, 'package.json')

async function main() {
  const pkgJson = require(pkgJsonPath)
  const binaryTarget = await getPlatform()
  const cacheDir = (await getCacheDir('master', '_local_', binaryTarget))!
  const branch = pkgJson?.enginesOverride?.branch as string | undefined
  let folder = pkgJson?.enginesOverride?.folder as string | undefined

  const engineCachePaths = {
    [BinaryType.queryEngine]: path.join(cacheDir, BinaryType.queryEngine),
    [BinaryType.libqueryEngine]: path.join(cacheDir, BinaryType.libqueryEngine),
    [BinaryType.migrationEngine]: path.join(cacheDir, BinaryType.migrationEngine),
    [BinaryType.introspectionEngine]: path.join(cacheDir, BinaryType.introspectionEngine),
    [BinaryType.prismaFmt]: path.join(cacheDir, BinaryType.prismaFmt),
  }

  if (branch !== undefined) {
    const enginesRepo = 'git@github.com:prisma/prisma-engines.git'

    if (fs.existsSync(path.join(baseDir, 'dist', 'prisma-engines')) !== true) {
      await execa('git', ['clone', enginesRepo, '--depth', '1', '--branch', branch], {
        cwd: path.join(baseDir, 'dist'),
        stdio: 'inherit',
      })
    }

    console.log(`Building branch "${pkgJson?.enginesOverride?.git}"`)
    await execa('cargo', ['build', '--release'], {
      cwd: path.join(baseDir, 'dist', 'prisma-engines'),
      stdio: 'inherit',
    })

    folder = path.join(baseDir, 'dist', 'prisma-engines', 'target', 'release')
  }

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
