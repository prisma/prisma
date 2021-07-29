import chalk from 'chalk'
import execa from 'execa'

/**
 * Runs a command and pipes the stdout & stderr to the current process.
 * @param cwd cwd for running the command
 * @param cmd command to run
 */
async function run(cwd: string, cmd: string): Promise<void> {
  try {
    await execa.command(cmd, {
      cwd,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        PRISMA_SKIP_POSTINSTALL_GENERATE: 'true',
      },
    })
  } catch (e) {
    throw new Error(
      chalk.red(
        `Error running ${chalk.bold(cmd)} in ${chalk.underline(cwd)}:`,
      ) + (e.stderr || e.stack || e.message),
    )
  }
}

async function all() {
  const argv = process.argv.slice(2)
  if (argv.length === 0) {
    throw new Error(
      `Please provide a command like so: ts-node scripts/ci/all.ts git status`,
    )
  }

  const command = argv.join(' ')

  console.log(
    chalk.cyanBright.bold(`prisma `.padEnd(10)) + chalk.bold(command) + '\n',
  )
  await run(`prisma`, command)

  console.log(
    '\n' +
      chalk.cyanBright.bold(`migrate `.padEnd(10)) +
      chalk.bold(command) +
      '\n',
  )
  await run(`migrate`, command)

  console.log(
    '\n' +
      chalk.cyanBright.bold(`prisma-client-js `.padEnd(10)) +
      chalk.bold(command) +
      '\n',
  )
  await run(`prisma-client-js`, command)
}

all()
