import execa from 'execa'

export async function pnpmInstall(cwd: string) {
  await pnpm(['install'], cwd)
}

export async function pnpmPrismaDbPush(cwd: string, dataProxy: boolean) {
  await pnpm(['prisma', 'db', 'push', '--accept-data-loss', '--force-reset', '--skip-generate'], cwd)
  const generate = ['prisma', 'generate']
  if (dataProxy) {
    generate.push('--data-proxy')
  }
  await pnpm(generate, cwd)
}

async function pnpm(command: string[], cwd: string) {
  await execa('pnpm', command, { cwd })
}
