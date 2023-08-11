import execa from 'execa'
import { bold, dim, red, underline } from 'kleur/colors'

async function main() {
  // this is for when you want to use it locally
  const buildOnly = process.argv[2] === '--build' // can we remove this?

  // TODO: separate into utils shared between publish & setup
  if (buildOnly === false) {
    console.debug(`Installing dependencies`)
    await run('.', `pnpm i`).catch((e) => {
      console.error(e)
    })
  }

  console.debug(`Building packages`)
  // Build CLI
  await run('.', `pnpm -r build`)

  if (buildOnly) {
    return
  }
}

// TODO: fix this
if (!module.parent) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

// TODO: export this into a utility folder
export async function run(cwd: string, cmd: string, dry = false): Promise<execa.ExecaReturnValue<string> | undefined> {
  const args = [underline('./' + cwd).padEnd(20), bold(cmd)]
  if (dry) {
    args.push(dim('(dry)'))
  }
  console.debug(args.join(' '))
  if (dry) {
    return
  }
  try {
    return await execa.command(cmd, {
      cwd,
      stdio: 'inherit',
    })
  } catch (_e) {
    const e = _e as execa.ExecaError
    throw new Error(bold(red(`Error running ${bold(cmd)} in ${underline(cwd)}:`)) + (e.stack || e.message))
  }
}
