import fs from 'fs'
import path from 'path'
import execa from 'execa'
import resolvePkg from 'resolve-pkg'
import hasYarn from 'has-yarn'
import chalk from 'chalk'
import globalDirectories from 'global-dirs'

export function isPackageInstalledGlobally(
  packageName: string,
): 'npm' | 'yarn' | false {
  try {
    const usingGlobalYarn = fs.existsSync(
      path.join(globalDirectories.npm.packages, packageName),
    )
    const usingGlobalNpm = fs.existsSync(
      path.join(globalDirectories.npm.packages, packageName),
    )

    if (usingGlobalNpm) {
      return 'npm'
    }
    if (usingGlobalYarn) {
      return 'yarn'
    } else {
      false
    }
  } catch (e) {
    //
  }
  return false
}

export function detectSeedFiles(schemaPath) {
  let parentDirectory = 'prisma'
  if (schemaPath) {
    parentDirectory = path.dirname(schemaPath)
  }
  const seedPath = path.join(process.cwd(), parentDirectory, 'seed.')

  const detected = {
    seedPath,
    numberOfSeedFiles: 0,
    js: '',
    ts: '',
    sh: '',
    go: '',
  }

  const extensions = ['js', 'ts', 'sh', 'go']
  for (const extension of extensions) {
    const fullPath = seedPath + extension
    if (!fs.existsSync(fullPath)) {
      continue
    }
    detected[extension] = fullPath
    detected.numberOfSeedFiles++
  }

  return detected
}

export async function tryToRunSeed(schemaPath: string | null) {
  const detected = detectSeedFiles(schemaPath)

  if (detected.numberOfSeedFiles === 0) {
    throw new Error(`No seed file found.
Create a \`seed.ts\`, \`.js\`, \`.sh\` or \`.go\` file in the prisma directory.`)
  } else if (detected.numberOfSeedFiles > 1) {
    throw new Error(
      `More than one seed file was found in \`${path.relative(
        process.cwd(),
        path.dirname(detected.seedPath),
      )}\` directory.
This command only supports one seed file: Use \`seed.ts\`, \`.js\`, \`.sh\` or \`.go\`.`,
    )
  } else {
    if (detected.js) {
      console.info('Running `node seed.js` ...')
      return await execa('node', [detected.js], {
        shell: true,
        stdio: 'inherit',
      })
    } else if (detected.ts) {
      const hasTypescriptPkg =
        resolvePkg('typescript') || isPackageInstalledGlobally('typescript')
      const hasTsNodePkg =
        resolvePkg('ts-node') || isPackageInstalledGlobally('ts-node')
      const hasTypesNodePkg = resolvePkg('@types/node')

      const missingPkgs: string[] = []
      if (!hasTypescriptPkg) {
        missingPkgs.push('typescript')
      }
      if (!hasTsNodePkg) {
        missingPkgs.push('ts-node')
      }
      if (!hasTypesNodePkg) {
        missingPkgs.push('@types/node')
      }

      if (missingPkgs.length > 0) {
        const packageManager = hasYarn() ? 'yarn add -D' : 'npm i -D'
        console.info(`We detected a seed file at \`prisma/seed.ts\` but it seems that you do not have the following dependencies installed:
${missingPkgs.map((name) => `- ${name}`).join('\n')}

To install them run: ${chalk.green(
          `${packageManager} ${missingPkgs.join(' ')}`,
        )}\n`)
      }

      console.info('Running `ts-node seed.ts` ...')
      return await execa('ts-node', [detected.ts], {
        shell: true,
        stdio: 'inherit',
      })
    } else if (detected.sh) {
      console.info('Running `sh seed.sh` ...')
      return await execa('sh', [detected.sh], {
        shell: true,
        stdio: 'inherit',
      })
    } else if (detected.go) {
      console.info('Running `go run seed.go` ...')
      return await execa('go run', [detected.go], {
        shell: true,
        stdio: 'inherit',
      })
    }
  }
}
