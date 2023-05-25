import Debug from '@prisma/debug'
import { getPrismaConfigFromPackageJson, link, logger } from '@prisma/internals'
import execa from 'execa'
import fs from 'fs'
import hasYarn from 'has-yarn'
import { bold, green, italic, red, yellow } from 'kleur/colors'
import path from 'path'
import pkgUp from 'pkg-up'

const debug = Debug('prisma:migrate:seed')

/*
  Checks if user has a prisma/seed.ts or prisma/seed.js or prisma/seed.sh
  If prisma.seed is not set in package.json it will return the best error message to help the user
*/
export async function verifySeedConfigAndReturnMessage(schemaPath: string | null): Promise<string | undefined> {
  const cwd = process.cwd()

  // Detect if seed files are next to schema.prisma file
  const detected = detectSeedFiles(cwd, schemaPath)

  const prismaConfig = await getPrismaConfigFromPackageJson(cwd)

  // New config is set in the package.json, no need for an error message
  if (prismaConfig && prismaConfig.data?.seed) {
    return undefined
  }

  // If new "seed" config is not set, help user to set it
  const packageManager = hasYarn() ? 'yarn add -D' : 'npm i -D'

  let message = `${red(
    'To configure seeding in your project you need to add a "prisma.seed" property in your package.json with the command to execute it:',
  )}

1. Open the package.json of your project
`

  if (detected.numberOfSeedFiles) {
    // Print warning if user has a "ts-node" script in their package.json, not supported anymore
    await legacyTsNodeScriptWarning()

    // Probably was using seed before 3.0 and need to add the seed property in package.json
    message += `2. Add the following example to it:`

    if (detected.js) {
      message += `
\`\`\`
"prisma": {
  "seed": "node ${detected.js}"
}
\`\`\`
`
    } else if (detected.ts) {
      message += `
\`\`\`
"prisma": {
  "seed": "ts-node ${detected.ts}"
}
\`\`\`
If you are using ESM (ECMAScript modules):
\`\`\`
"prisma": {
  "seed": "node --loader ts-node/esm ${detected.ts}"
}
\`\`\`

3. Install the required dependencies by running:
${green(`${packageManager} ts-node typescript @types/node`)}
`
    } else if (detected.sh) {
      message += `
\`\`\`
"prisma": {
  "seed": "${detected.sh}"
}
\`\`\`
And run \`chmod +x ${detected.sh}\` to make it executable.`
    }
  } else {
    message += `2. Add one of the following examples to your package.json:

${bold('TypeScript:')}
\`\`\`
"prisma": {
  "seed": "ts-node ./prisma/seed.ts"
}
\`\`\`
If you are using ESM (ECMAScript modules):
\`\`\`
"prisma": {
  "seed": "node --loader ts-node/esm ./prisma/seed.ts"
}
\`\`\`

And install the required dependencies by running:
${packageManager} ts-node typescript @types/node

${bold('JavaScript:')}
\`\`\`
"prisma": {
  "seed": "node ./prisma/seed.js"
}
\`\`\`

${bold('Bash:')}
\`\`\`
"prisma": {
  "seed": "./prisma/seed.sh"
}
\`\`\`
And run \`chmod +x prisma/seed.sh\` to make it executable.`
  }

  message += `\nMore information in our documentation:\n${link('https://pris.ly/d/seeding')}`

  return message
}

export async function getSeedCommandFromPackageJson(cwd: string) {
  const prismaConfig = await getPrismaConfigFromPackageJson(cwd)

  debug({ prismaConfig })

  if (!prismaConfig || !prismaConfig.data?.seed) {
    return null
  }

  const seedCommandFromPkgJson = prismaConfig.data.seed

  // Validate if seed command is a string
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

export async function executeSeedCommand({
  commandFromConfig,
  extraArgs,
}: {
  commandFromConfig: string
  extraArgs?: string
}): Promise<boolean> {
  let command = commandFromConfig

  // Used in `DbSeed.ts` to pass the extra params after a -- separator
  // Example: db seed -- --custom-param
  // Then extraArgs will be '--custom-param'
  if (extraArgs) {
    command = `${commandFromConfig} ${extraArgs}`
  }

  console.info(`Running seed command \`${italic(command)}\` ...`)
  try {
    await execa.command(command, {
      stdout: 'inherit',
      stderr: 'inherit',
    })
  } catch (_e) {
    const e = _e as execa.ExecaError
    debug({ e })
    console.error(bold(red(`\nAn error occurred while running the seed command:`)))
    console.error(red(e.stderr || String(e)))
    return false
  }

  return true
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

  debug({ detected })

  return detected
}

export async function legacyTsNodeScriptWarning() {
  // Check package.json for a "ts-node" script (so users can customize flags)
  const scripts = await getScriptsFromPackageJson()

  if (scripts?.['ts-node']) {
    logger.warn(
      yellow(`The "ts-node" script in the package.json is not used anymore since version 3.0 and can now be removed.`),
    )
  }

  return undefined
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

    const pkgJsonString = await fs.promises.readFile(pkgJsonPath, 'utf-8')

    const pkgJson: PkgJSON = JSON.parse(pkgJsonString)

    // Pick and return only items we need
    const { 'ts-node': tsnode } = pkgJson.scripts

    return { 'ts-node': tsnode }
  } catch {
    return null
  }
}
