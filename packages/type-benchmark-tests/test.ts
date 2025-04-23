import execa from 'execa'
import { readdirSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

// @ts-ignore
const parentDir = dirname(fileURLToPath(import.meta.url))

const directoryBlockList = ['node_modules']

async function main() {
  const directories = getTestDirectories()
  const updateSnapshots = shouldUpdateSnapshots()
  const testFilter = getTestFilter()

  const results: {
    directory: string
    success: boolean
    skipped?: boolean
  }[] = []

  let hasAnyFailure = false

  for (const dir of directories) {
    const cwd = join(parentDir, dir)
    console.log(`\nProcessing directory: ${dir}`)

    try {
      await runGenerate(dir, cwd)

      const benchFiles = getBenchmarkFiles(dir)
      for (const benchFile of benchFiles) {
        if (testFilter && !`${dir}/${benchFile}`.includes(testFilter)) {
          console.log(`Skipping ${benchFile} - does not match filter: ${testFilter}`)
          results.push({
            directory: `${dir}/${benchFile}`,
            success: false,
            skipped: true,
          })
          continue
        }
        results.push(await runBenchmark({ benchFile, cwd, updateSnapshots, dir }))
      }
    } catch (error) {
      hasAnyFailure = true
      results.push({
        directory: `${dir}/*`,
        success: false,
      })
    }
  }

  printResults(results, updateSnapshots)

  process.exit(hasAnyFailure ? 1 : 0)
}

main().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})

function shouldUpdateSnapshots() {
  const args = process.argv.slice(2)
  const updateSnapshots = args.includes('--u') || args.includes('--updateSnapshots')

  if (updateSnapshots) {
    console.log('ℹ️ 🎥 Updating snapshots...')
  }
  return updateSnapshots
}

function getTestFilter() {
  const args = process.argv.slice(2)
  const filterArg = args.find((arg) => !arg.startsWith('--'))
  return filterArg
}

function getTestDirectories() {
  return readdirSync(parentDir).filter((item) => {
    const fullPath = join(parentDir, item)
    return statSync(fullPath).isDirectory() && !directoryBlockList.includes(item)
  })
}

function getBenchmarkFiles(dir: string) {
  return readdirSync(dir).filter((item) => {
    return statSync(join(dir, item)).isFile() && item.endsWith('.bench.ts')
  })
}

async function runGenerate(dir: string, cwd: string) {
  console.log(`Running generate command in ${dir}...`)
  await execa('tsx', ['../../cli/src/bin.ts', 'generate'], { cwd, stdio: 'inherit' })
}

async function runBenchmark({
  benchFile,
  cwd,
  updateSnapshots,
  dir,
}: {
  benchFile: string
  cwd: string
  updateSnapshots: boolean
  dir: string
}) {
  console.log(`Running ${dir}/${benchFile}...`)
  try {
    await execa('tsx', [benchFile], {
      cwd,
      stdio: 'inherit',
      env: { ATTEST_updateSnapshots: updateSnapshots ? 'true' : 'false' },
    })
    return {
      directory: `${dir}/${benchFile}`,
      success: true,
    }
  } catch {
    return {
      directory: `${dir}/${benchFile}`,
      success: false,
    }
  }
}

function printResults(results: { directory: string; success: boolean; skipped?: boolean }[], updateSnapshots: boolean) {
  console.log('\nResults:')
  console.log('========================')
  results.forEach((result) => {
    const status = result.skipped ? '⏩ Skipped' : result.success ? '✅ Success' : '❌ Failed'
    console.log(`${status} - ${result.directory}`)
  })
  console.log('========================')
  if (updateSnapshots) console.log('✅ 🎥 Updated snapshots')
  console.log('========================')
}
