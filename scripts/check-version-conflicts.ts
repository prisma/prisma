import arg from 'arg'
import execa from 'execa'
import { promises as fs } from 'fs'
import globby from 'globby'
import { blue, bold, dim, red, underline } from 'kleur/colors'
import pMap from 'p-map'
import path from 'path'

type PackageUser = {
  path: string
  version: string
  dev: boolean
}

const tab = '  '

async function main() {
  const packagePaths = await globby(
    ['migrate/package.json', 'prisma2/cli/**/package.json', 'prisma-client-js/packages/**/package.json'],
    {
      ignore: ['**/node_modules/**', '**/examples/**'],
    },
  )
  const packages = await Promise.all(
    packagePaths.map(async (p) => ({
      path: p,
      package: JSON.parse(await fs.readFile(p, 'utf-8')),
    })),
  )

  const packageCache: { [key: string]: PackageUser[] } = {}

  for (const p of packages) {
    const handler =
      (dev) =>
      ([name, version]: any) => {
        const v = version.replace('^', '')
        if (packageCache[name]) {
          if (packageCache[name].find((c) => c.version !== v)) {
            packageCache[name].push({
              path: p.path,
              version: v,
              dev,
            })
          }
        } else {
          packageCache[name] = [{ path: p.path, version: v, dev }]
        }
      }
    if (p.package.dependencies) {
      Object.entries(p.package.dependencies).forEach(handler(false))
    }
    if (p.package.devDependencies) {
      Object.entries(p.package.devDependencies).forEach(handler(true))
    }
  }

  Object.entries(packageCache).forEach(([key, value]) => {
    let out = '\n'
    if (value.length > 1) {
      out += bold(red(`Version mismatch`)) + ` for ${bold(blue(key))}\n`
      value.forEach((v) => {
        out += `${tab}${underline(v.path).padEnd(60)}${v.version.padEnd(20)} ${
          v.dev ? dim('dependency') : dim('devDependency')
        }\n`
      })
      console.error(out)
    }
  })

  console.log(`Found mismatches for ${Object.values(packageCache).filter((v) => v.length > 1).length} packages`)

  const argv = arg({
    ['--auto-fix']: Boolean,
  })

  const denyList = ['@zeit/ncc', 'prisma-datamodel']

  if (argv['--auto-fix']) {
    console.log('Auto fix turned on...')
    await pMap(
      Object.entries(packageCache),
      async ([packageName, packageUsers]) => {
        if (denyList.includes(packageName)) {
          return
        }
        if (!packageName.startsWith('@types')) {
          return
        }
        const latestVersion = await runResult('.', `npm info ${packageName} version`)
        console.log(`\nSetting ${blue(`${packageName}@${latestVersion}`)}`)
        await pMap(
          packageUsers,
          async (u) => {
            await run(path.dirname(u.path), `yarn add ${packageName}@${latestVersion}${u.dev ? ' -D' : ''}`)
          },
          { concurrency: 1 },
        )
      },
      { concurrency: 1 },
    )
  }
}

void main()

async function runResult(cwd: string, cmd: string): Promise<string> {
  try {
    const result = await execa.command(cmd, {
      cwd,
      stdio: 'pipe',
    })
    return result.stdout
  } catch (e) {
    throw new Error(bold(red(`Error running ${bold(cmd)} in ${underline(cwd)}:`) + (e.stderr || e.stack || e.message)))
  }
}

async function run(cwd: string, cmd: string): Promise<void> {
  console.log(underline('./' + cwd).padEnd(20), bold(cmd))
  try {
    await execa.command(cmd, {
      cwd,
      stdio: 'inherit',
    })
  } catch (e) {
    throw new Error(bold(red(`Error running ${bold(cmd)} in ${underline(cwd)}:`) + (e.stderr || e.stack || e.message)))
  }
}
