import execa from 'execa'
import fs from 'fs'
import path from 'path'

type PublishEntry = {
  name: string
  path: string
}

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const tagArg = process.argv.find((arg) => arg.startsWith('--tag='))
const tag = tagArg ? tagArg.split('=')[1] : 'alpha'
const noGitChecks = args.has('--no-git-checks')

const main = async () => {
  const listPath = path.join(process.cwd(), 'scripts', 'publish-list.json')
  const entries = JSON.parse(fs.readFileSync(listPath, 'utf-8')) as PublishEntry[]

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Publish list is empty or invalid.')
  }

  const versions = new Set<string>()

  for (const entry of entries) {
    const pkgPath = path.join(process.cwd(), entry.path, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { name: string; version: string }

    if (pkg.name !== entry.name) {
      throw new Error(`Publish list mismatch: ${entry.name} vs ${pkg.name} at ${entry.path}`)
    }

    if (!pkg.version) {
      throw new Error(`Missing version in ${entry.name}`)
    }

    versions.add(pkg.version)
  }

  if (versions.size > 1) {
    throw new Error(`Version mismatch across packages: ${Array.from(versions).join(', ')}`)
  }

  for (const entry of entries) {
    const command = ['--filter', entry.name, 'publish', '--tag', tag]
    if (dryRun) {
      command.push('--dry-run')
    }
    if (noGitChecks) {
      command.push('--no-git-checks')
    }

    console.log(`pnpm ${command.join(' ')}`)
    await execa('pnpm', command, { stdio: 'inherit' })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
