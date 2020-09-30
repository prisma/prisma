const path = require('path')
const fs = require('fs')
const mockFs = require('./mock-fs')
const { promisify } = require('util')
const writeFile = promisify(fs.writeFile)
const makeDir = require('make-dir')
const del = require('del')

const runtimeTsConfig = {
  compilerOptions: {
    lib: ['esnext', 'esnext.asynciterable'],
    module: 'commonjs',
    target: 'es2018',
    strict: false,
    esModuleInterop: true,
    sourceMap: true,
    noImplicitAny: false,
    outDir: 'runtime',
    rootDir: 'src/runtime',
    declaration: true,
  },
  include: ['src/runtime'],
  exclude: [
    'archive',
    'dist',
    'build',
    'cli',
    'examples',
    'runtime',
    'src/fixtures',
    'src/__tests__',
  ],
}

mockFs({
  [path.join(__dirname, '../tsconfig.json')]: JSON.stringify(
    runtimeTsConfig,
    null,
    2,
  ),
})

const options = {
  minify: true,
  sourceMap: true,
  sourceMapRegister: false,
}

let targetDir = path.join(__dirname, '../runtime')
let sourceFile = path.join(__dirname, '../src/runtime/index.ts')

require('@vercel/ncc')(sourceFile, options)
  .then(async ({ code, map, assets }) => {
    // Assets is an object of asset file names to { source, permissions, symlinks }
    // expected relative to the output code (if any)
    await saveToDisc(code, map, assets, targetDir)
  })
  .catch(console.error)

async function saveToDisc(source, map, assets, outputDir) {
  await del([
    outputDir + '/**',
    '!' + outputDir,
    `!${path.join(outputDir, 'prisma')}`,
  ])
  await makeDir(outputDir)
  assets['index.js'] = { source: fixCode(source) }
  if (map) {
    assets['index.js.map'] = map
  }
  // TODO add concurrency when we would have too many files
  const madeDirs = {}
  const files = []
  await Promise.all(
    Object.entries(assets).map(async ([filePath, file]) => {
      const targetPath = path.join(outputDir, filePath)
      const targetDir = path.dirname(targetPath)
      if (!madeDirs[targetDir]) {
        await makeDir(targetDir)
        madeDirs[targetDir] = true
      }
      if (!file.source) {
        files.push({
          size: Math.round(file.length / 1024),
          targetPath,
        })
        await writeFile(targetPath, file)
      } else {
        files.push({
          size: Math.round(file.source.length / 1024),
          targetPath,
        })
        await writeFile(targetPath, file.source)
      }
    }),
  )
  files.sort((a, b) => (a.size < b.size ? -1 : 1))
  const max = files.reduce((max, curr) => Math.max(max, curr.size), 0)
  const maxLength = `${max}kB`.length
  const doneStr = files
    .map(
      ({ size, targetPath }) =>
        `${size}kB`.padStart(maxLength) +
        '  ' +
        path.relative(process.cwd(), targetPath),
    )
    .join('\n')
  console.log(doneStr)
}

function fixCode(code) {
  return code
    .split('\n')
    .map((line) => {
      if (line.startsWith('NodeEngine.defaultPrismaPath = path.join(')) {
        return `NodeEngine.defaultPrismaPath = path.join(__dirname + '/prisma');`
      }
      return line
    })
    .join('\n')
}
