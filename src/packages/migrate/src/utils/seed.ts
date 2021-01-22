import fs from 'fs'
import path from 'path'
import execa from 'execa'

export function detectSeedFiles(schemaPath) {
  let parentDirectory = 'prisma'
  if (schemaPath) {
    parentDirectory = path.dirname(schemaPath)
  }
  const seedPath = path.join(process.cwd(), parentDirectory, 'seed.')

  const detected = {
    seedPath,
    numberOfSeedFiles: 0,
    js: '',
    ts: '',
    sh: '',
    go: '',
  }

  const extensions = ['js', 'ts', 'sh', 'go']
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

export async function tryToRunSeed(schemaPath: string | null) {
  const detected = detectSeedFiles(schemaPath)

  if (detected.numberOfSeedFiles === 0) {
    throw new Error(`No seed file found.
Create a \`seed.ts\`, \`.js\`, \`.sh\` or \`.go\` file in the prisma directory.`)
  } else if (detected.numberOfSeedFiles > 1) {
    throw new Error(
      `More than one seed file was found in \`${path.relative(
        process.cwd(),
        path.dirname(detected.seedPath),
      )}\` directory.
This command only supports one seed file: Use \`seed.ts\`, \`.js\`, \`.sh\` or \`.go\`.`,
    )
  } else {
    if (detected.js) {
      console.info('Running `node seed.js` ...')
      return await execa('node', [detected.js], {
        shell: true,
        stdio: 'inherit',
      })
    } else if (detected.ts) {
      console.info('Running `ts-node seed.ts` ...')
      return await execa('ts-node', [detected.ts], {
        shell: true,
        stdio: 'inherit',
      })
    } else if (detected.sh) {
      console.info('Running `sh seed.sh` ...')
      return await execa('sh', [detected.sh], {
        shell: true,
        stdio: 'inherit',
      })
    } else if (detected.go) {
      console.info('Running `go run seed.go` ...')
      return await execa('go run', [detected.go], {
        shell: true,
        stdio: 'inherit',
      })
    }
  }
}
