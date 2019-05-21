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
    target: 'es2017',
    strict: false,
    esModuleInterop: true,
    sourceMap: true,
    noImplicitAny: false,
    outDir: 'runtime',
    rootDir: 'src/runtime',
    declaration: true,
  },
  include: ['src/runtime'],
  exclude: ['archive', 'dist', 'build', 'cli', 'examples', 'runtime', 'src/fixtures', 'src/__tests__'],
}

mockFs({
  [path.join(__dirname, '../tsconfig.json')]: JSON.stringify(runtimeTsConfig, null, 2),
})

require('@zeit/ncc')(path.join(__dirname, '../src/runtime/index.ts'), {})
  .then(async ({ code, map, assets }) => {
    // Assets is an object of asset file names to { source, permissions, symlinks }
    // expected relative to the output code (if any)
    await saveToDisc(code, map, assets, path.join(__dirname, '../runtime'))
  })
  .catch(console.error)

async function saveToDisc(source, map, assets, outputDir) {
  await del([
    outputDir + '/**',
    '!' + outputDir,
    `!${path.join(outputDir, 'prisma')}`,
    `!${path.join(outputDir, 'schema-inferrer-bin')}`,
  ])
  await makeDir(outputDir)
  assets['index.js'] = { source }
  if (map) {
    assets['index.js.map'] = map
  }
  // TODO add concurrency when we would have too many files
  const madeDirs = {}
  await Promise.all(
    Object.entries(assets).map(async ([filePath, file]) => {
      const targetPath = path.join(outputDir, filePath)
      const targetDir = path.dirname(targetPath)
      if (!madeDirs[targetDir]) {
        await makeDir(targetDir)
        madeDirs[targetDir] = true
      }
      // if (filePath === 'index.d.ts') {
      // let content = file.source.toString()
      // content = content.replace('@prisma/engine-core', './dist/Engine')
      //   await writeFile(targetPath, indexDTS, 'utf-8')
      // } else {
      await writeFile(targetPath, file.source)
      // }
    }),
  )
  const after = Date.now()
}
