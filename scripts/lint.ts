import execa from 'execa'
import path from 'path'
import chalk from 'chalk'
import os from 'os'
import arg from 'arg'
import globby from 'globby'
import staged from 'staged-git-files'
import pMap from 'p-map'

async function main() {
  const args = arg({
    '--staged': Boolean,
  })

  if (args._.length === 1) {
    const result = await lintPackage(args._[0])
    if (!result) {
      process.exit(1)
    }
  }

  let packages = []
  if (args['--staged']) {
    packages = await getStagedPackages()
  } else {
    packages = await getAllPackages()
  }

  if (packages.length === 0) {
    console.log(
      chalk.blueBright('Nothing to lint ') + chalk.bold.greenBright(`✔️`),
    )
  }

  const results = await pMap(
    packages,
    (pkg) => lintPackage(pkg, args['--staged']),
    {
      concurrency: args['--staged'] ? 1 : os.cpus().length,
    },
  )

  if (results.some((r) => !r)) {
    process.exit(1)
  }
}

/**
 * Examples:
 * Lint all packages:
 * pnpm run lint
 *
 * Lint a specific package:
 * pnpm run lint <package-name>
 * pnpm run lint engine-core
 * pnpm run lint client
 *
 * Lint the staged files:
 * pnpm run lint --staged
 */

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

async function getAllPackages(): Promise<string[]> {
  const packages = await globby('./src/packages/*/package.json')
  return packages.map((p) => path.basename(path.dirname(p)))
}

async function lintPackage(
  pkg: string,
  stagedOnly: boolean = false,
): Promise<boolean> {
  try {
    const lint = process.env.CI ? 'lint-ci' : 'lint'
    const command = `pnpm run ${stagedOnly ? 'precommit' : lint}`
    console.log(`${pkg}: running ${command}`)
    await execa.command(command, {
      cwd: path.join(__dirname, `../src/packages/${pkg}`),
      stdio: 'pipe',
      env: {
        ...process.env,
        FORCE_COLOR: '1',
      },
    })
    printPkg(chalk.bold.greenBright(`✔️`), pkg)
    return true
  } catch (e) {
    console.log()
    printPkg(e.stdout, pkg)
    printPkg(e.stderr, pkg)
    return false
  }
}

function prefixLine(color: string, pkg: string, line: string) {
  return `${chalk.bold.underline[color](pkg)} ${line}`
}

function printPkg(msg: string, pkg: string) {
  const color = getColor()
  console.log(
    msg
      .split('\n')
      .map((l) => prefixLine(color, pkg, l))
      .join('\n'),
  )
}

async function getStagedPackages(): Promise<string[]> {
  const files: Array<{ filename: string; status: string }> = await staged()
  return Object.keys(
    files.reduce((acc, { filename }) => {
      if (filename.startsWith('src/packages')) {
        // "src/packages/".length === 13
        let packageName = filename.slice(13)
        packageName = packageName.slice(0, packageName.indexOf('/'))
        if (!acc[packageName]) {
          acc[packageName] = true
        }
      }
      return acc
    }, {}),
  )
}

const colors = [
  'blue',
  'yellow',
  'magenta',
  'blueBright',
  'magentaBright',
  'cyanBright',
  'cyan',
  'green',
  'black',
  'white',
  'blackBright',
  'redBright',
  'greenBright',
  'yellowBright',
  'whiteBright',
]

let colorIndex = 0

function getColor() {
  return colors[colorIndex++ % colors.length]
}
