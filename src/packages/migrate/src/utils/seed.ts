import fs from 'fs'
import path from 'path'
import execa from 'execa'
import hasYarn from 'has-yarn'
import chalk from 'chalk'
import globalDirectories from 'global-dirs'
import pkgUp from 'pkg-up'
import { promisify } from 'util'
import { getPrismaConfigFromPackageJson, logger } from '@prisma/sdk'

const readFileAsync = promisify(fs.readFile)

export async function verifySeedConfig(schemaPath: string | null) {
  const cwd = process.cwd()

  // Detect if seed files are next to prisma.schema file
  const detected = detectSeedFiles(cwd, schemaPath)

  const prismaConfig = await getPrismaConfigFromPackageJson(cwd)

  // If new "seed" config is not set, help user to set it
  if (!prismaConfig || !prismaConfig.data?.seed) {
    const packageManager = hasYarn() ? 'yarn add -D' : 'npm i -D'

    // TODO link to docs
    let message = `${chalk.red(
      'To configure seeding in your project you need to add a "seed" property in your package.json with the command to execute it:',
    )}

1. Open the package.json of your project
`

    if (detected.numberOfSeedFiles === 1) {
      // Probably was using seed before 2.27.0 and need to add the seed property in package.json
      message += `2. Add the following example to it:`

      if (detected.js) {
        message += `
\`\`\`
"prisma": {
  "seed": "node ${detected.seedPath}js"
}
\`\`\`
`
      } else if (detected.ts) {
        message += `
\`\`\`
"prisma": {
  "seed": "ts-node ${detected.seedPath}ts"
}
\`\`\`

3. Install the required dependencies by running:
${chalk.green(`${packageManager} ts-node typescript @types/node`)}
`
      } else if (detected.sh) {
        message += `
\`\`\`
"prisma": {
  "seed": "${detected.seedPath}sh"
}
\`\`\``
      }
    } else {
      message += `2. Add one of the following example to your package.json:

${chalk.bold('TypeScript:')}
\`\`\`
"prisma": {
  "seed": "ts-node ./prisma/seed.ts"
}
\`\`\`
And install the required dependencies by running:
${packageManager} ts-node typescript @types/node

${chalk.bold('JavaScript:')}
\`\`\`
"prisma": {
  "seed": "node ./prisma/seed.js"
}
\`\`\`

${chalk.bold('Bash:')}
\`\`\`
"prisma": {
  "seed": "./prisma/seed.sh"
}
\`\`\``
    }

    throw new Error(message)
  }
}

export async function getSeedCommandFromPackageJson(cwd: string) {
  const prismaConfig = await getPrismaConfigFromPackageJson(cwd)
  if (!prismaConfig || !prismaConfig.data?.seed) {
    return null
  }

  const seedCommandFromPkgJson = prismaConfig.data.seed

  // Validate if seed commad is a string
  if (typeof seedCommandFromPkgJson !== 'string') {
    throw new Error(
      `Provided seed command \`${seedCommandFromPkgJson}\` from \`${path.relative(
        cwd,
        prismaConfig.packagePath,
      )}\` must be of type string`,
    )
  }

  if (!seedCommandFromPkgJson) {
    throw new Error(
      `Provided seed command \`${seedCommandFromPkgJson}\` from \`${path.relative(
        cwd,
        prismaConfig.packagePath,
      )}\` cannot be empty`,
    )
  }

  return seedCommandFromPkgJson
}

export async function executeSeedCommand(command: string) {
  // Execute user seed command
  return await execa(command, {
    shell: true,
    stdio: 'inherit',
  })
}

function isPackageInstalledGlobally(
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

function detectSeedFiles(cwd, schemaPath) {
  let parentDirectory = path.relative(cwd, path.join(cwd, 'prisma'))
  if (schemaPath) {
    parentDirectory = path.relative(cwd, path.dirname(schemaPath))
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

export async function legacyTsNodeScriptWarning() {
  // Check package.json for a "ts-node" script (so users can customize flags)
  const scripts = await getScriptsFromPackageJson()

  if (scripts?.['ts-node']) {
    logger.warn(
      chalk.yellow(
        `The "ts-node" script in the package.json is not used anymore since 2.27.0 and can now be removed.`,
      ),
    )
  }
}

async function getScriptsFromPackageJson(cwd: string = process.cwd()) {
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
  } catch {
    return null
  }
}
