import fs from 'fs'
import path from 'path'
import execa from 'execa'
import resolvePkg from 'resolve-pkg'
import hasYarn from 'has-yarn'
import chalk from 'chalk'
import globalDirectories from 'global-dirs'
import pkgUp from 'pkg-up'
import { promisify } from 'util'

const readFileAsync = promisify(fs.readFile)

export function isPackageInstalledGlobally(
  packageName: string,
): 'npm' | 'yarn' | false {
  try {
    const usingGlobalYarn = fs.existsSync(
      path.join(globalDirectories.yarn.packages, packageName),
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
  let parentDirectory = path.relative(
    process.cwd(),
    path.join(process.cwd(), 'prisma'),
  )
  if (schemaPath) {
    parentDirectory = path.relative(process.cwd(), path.dirname(schemaPath))
  }

  const seedPath = path.join(parentDirectory, 'seed.')

  const detected = {
    seedPath,
    numberOfSeedFiles: 0,
    js: '',
    ts: '',
    sh: '',
  }

  const extensions = ['js', 'ts', 'sh']
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

function getSeedScript(type: 'TS' | 'JS', seedFilepath: string) {
  let script = `
console.info('Result:')

const __seed = require('./${seedFilepath}')
const __keys = Object.keys(__seed)

async function runSeed() {
  // Execute "seed" named export or default export
  if (__keys && __keys.length) {
    if (__keys.indexOf('seed') !== -1) {
      return __seed.seed()
    } else if (__keys.indexOf('default') !== -1) {
      return __seed.default()
    }
  }
}

runSeed()
  .then(function (result) {
    if (result) {
      console.log(result)
    }
  })
  .catch(function (e) {
    console.error('Error from seed:')
    throw e
  })
`

  if (type === 'TS') {
    script = `
// @ts-ignore
declare const require: any

${script}`
  }

  return script
}

export async function tryToRunSeed(schemaPath: string | null) {
  const detected = detectSeedFiles(schemaPath)

  if (detected.numberOfSeedFiles === 0) {
    throw new Error(`No seed file found.
Create a \`seed.ts\`, \`.js\` or \`.sh\` file in the prisma directory.`)
  } else if (detected.numberOfSeedFiles > 1) {
    throw new Error(
      `More than one seed file was found in \`${path.relative(
        process.cwd(),
        path.dirname(detected.seedPath),
      )}\` directory.
This command only supports one seed file: Use \`seed.ts\`, \`.js\` or \`.sh\`.`,
    )
  } else {
    if (detected.js) {
      console.info(`Running seed from ${chalk.bold(`"${detected.js}"`)} ...`)

      // -e (Evaluate the following argument as JavaScript.)
      return await execa('node', [`-e "${getSeedScript('JS', detected.js)}"`], {
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
        console.info(`We detected a seed file at \`${
          detected.ts
        }\` but it seems that you do not have the following dependencies installed:
${missingPkgs.map((name) => `- ${name}`).join('\n')}

To install them run: ${chalk.green(
          `${packageManager} ${missingPkgs.join(' ')}`,
        )}\n`)
      }

      // Check package.json for a "ts-node" script (so users can customize flags)
      const scripts = await getScriptsFromPackageJson()
      let tsNodeCommand = 'ts-node'
      let tsNodeArgs = `--eval "${getSeedScript('TS', detected.ts)}"`

      // User can customize the `ts-node` command from the package script
      if (scripts?.['ts-node']) {
        tsNodeCommand = scripts['ts-node']
        tsNodeArgs = `"${detected.ts}"`
        console.info(
          `Running seed: ${chalk.bold(`${tsNodeCommand} ${tsNodeArgs}`)} ...`,
        )
      } else {
        console.info(`Running seed from ${chalk.bold(`${detected.ts}`)} ...`)
      }

      return await execa(tsNodeCommand, [tsNodeArgs], {
        shell: true,
        stdio: 'inherit',
      })
    } else if (detected.sh) {
      console.info(`Running seed: ${chalk.bold(`sh "${detected.sh}"`)} ...`)
      return await execa('sh', [`"${detected.sh}"`], {
        shell: true,
        stdio: 'inherit',
      })
    }
  }
}

export async function getScriptsFromPackageJson(cwd: string = process.cwd()) {
  interface PkgJSON {
    scripts: PkgJSONScripts
  }
  interface PkgJSONScripts {
    [key: string]: string
  }

  try {
    const pkgJsonPath = await pkgUp({ cwd })

    if (!pkgJsonPath) {
      return null
    }

    const pkgJsonString = await readFileAsync(pkgJsonPath, 'utf-8')

    const pkgJson: PkgJSON = JSON.parse(pkgJsonString)

    // Pick and return only items we need
    const { 'ts-node': tsnode } = pkgJson.scripts

    return { 'ts-node': tsnode }
  } catch (_) {
    return null
  }
}
