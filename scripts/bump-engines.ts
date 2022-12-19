import arg from 'arg'
import chalk from 'chalk'
import execa from 'execa'
import path from 'path'

const argv = arg({})
const usage = chalk`
{bold Usage}
\t{dim pnpm bump-engines 2.19.0-39.c1455d0b443d66b0d9db9bcb1bb9ee0d5bbc511d}
\t{dim pnpm bump-engines latest}
\t{dim pnpm bump-engines integration}
\t{dim pnpm bump-engines patch}
`

async function main() {
  let version = argv._[0]
  if (!version) {
    console.error(`No Version Found\n${usage}`)
    console.log(chalk`Defaulting to {dim latest}`)
    version = 'latest'
  }

  // Update `@prisma/engines-version` version in all package.json
  await run(path.join(__dirname, '..'), `pnpm update -r @prisma/engines-version@${version}`)
  // Update `@prisma/prisma-fmt-wasm` version in all package.json
  await run(path.join(__dirname, '..'), `pnpm update -r @prisma/prisma-fmt-wasm@${version}`)

  await run(path.join(__dirname, '..'), `pnpm run --filter @prisma/engines dev`)
  await run(path.join(__dirname, '..'), `pnpm run --filter @prisma/engines postinstall`)
}

void main()

async function run(cwd: string, cmd: string): Promise<void> {
  console.log(chalk.underline('./' + cwd).padEnd(20), chalk.bold(cmd))
  try {
    await execa.command(cmd, {
      cwd,
      stdio: 'inherit',
    })
  } catch (e) {
    throw new Error(
      chalk.bold.red(`Error running ${chalk.bold(cmd)} in ${chalk.underline(cwd)}:`) +
        (e.stderr || e.stack || e.message),
    )
  }
}
