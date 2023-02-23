// @ts-check

const path = require('path')
const fs = require('fs/promises')

// when client is bundled this gets its output path
// regex works both on escaped and non-escaped code
const prismaDirRegex =
  /\\?['"]?output\\?['"]?:\s*{(?:\\n?|\s)*\\?['"]?value\\?['"]?:(?:\\n?|\s)*\\?['"](.*?)\\?['"],(?:\\n?|\s)*\\?['"]?fromEnvVar\\?['"]?/g

async function getPrismaDir(from) {
  // if we can find schema.prisma in the path, we are done
  if (await fs.stat(path.join(from, 'schema.prisma')).catch(() => false)) {
    return from
  }

  // otherwise we need to find the generated prisma client
  return path.dirname(require.resolve('.prisma/client', { paths: [from] }))
}

// get all required prisma files (schema + engine)
async function getPrismaFiles(from) {
  const prismaDir = await getPrismaDir(from)
  const filterRegex = /schema\.prisma|.*?engine.*?/
  const prismaFiles = await fs.readdir(prismaDir)

  return prismaFiles.filter((file) => file.match(filterRegex))
}

class PrismaPlugin {
  constructor(options = {}) {
    this.options = options
  }

  /**
   * @param {import('webpack').Compiler} compiler
   */
  apply(compiler) {
    const { webpack } = compiler
    const { Compilation, sources } = webpack

    /** @type { { [assetDir: string]: { [from: string]: string } } } */
    const prismaCopyMap = {} // { [assetDir]: { [from]: dest } }

    // read bundles to find which prisma files to copy (for all users)
    compiler.hooks.compilation.tap('PrismaPlugin', (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: 'PrismaPlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_ANALYSE,
        },
        async (assets) => {
          const jsAssetNames = Object.keys(assets).filter((k) => k.endsWith('.js'))
          const jsAsyncActions = jsAssetNames.map(async (assetName) => {
            // prepare paths
            const outputDir = compiler.outputPath
            const assetPath = path.resolve(outputDir, assetName)
            const assetDir = path.dirname(assetPath)

            // get sources
            const sourceAsset = compilation.getAsset(assetName)
            let sourceContents = sourceAsset.source.source() + ''

            // update copy map
            prismaCopyMap[assetDir] = prismaCopyMap[assetDir] ?? {}
            for (const match of sourceContents.matchAll(prismaDirRegex)) {
              const prismaDir = await getPrismaDir(match[1])
              const prismaFiles = await getPrismaFiles(match[1])

              prismaFiles.forEach((f) => {
                let dest = path.join(assetDir, f)
                let from = path.join(prismaDir, f)

                if (f === 'schema.prisma') {
                  // if multiple clients are bundled, we prepare copying multiple schemas
                  const schemas = Object.keys(prismaCopyMap[assetDir]).filter((value) => {
                    return value.includes('schema.prisma')
                  })

                  dest += schemas.length + 1

                  // update the prisma client config to point to the updated schema name
                  // this logic is terrible, inlining the schema would get rid of it
                  const schema = path.basename(dest)
                  const configOutputIndex = sourceContents.indexOf(match[1])
                  const configDmmfIndex = sourceContents.indexOf('.document = dmmf', configOutputIndex)
                  const sliceToReplace = sourceContents.slice(configOutputIndex, configDmmfIndex + 16)
                  const configObject = sliceToReplace.match(/(\w+?)\.document =/)?.[1]
                  let sliceReplacement
                  if (match[0][0] === '\\' /** happens in next.js dev mode/hot reload */) {
                    sliceReplacement = `${sliceToReplace};${configObject}.filename = \\"${schema}\\";${configObject}.dirname = __dirname;`
                  } else {
                    sliceReplacement = `${sliceToReplace};${configObject}.filename = "${schema}";${configObject}.dirname = __dirname;`
                  }

                  sourceContents = sourceContents.replace(sliceToReplace, sliceReplacement)
                }

                prismaCopyMap[assetDir][from] = dest
              })
            }

            const newRawSource = new sources.RawSource(sourceContents)
            compilation.updateAsset(assetName, newRawSource)
          })

          await Promise.all(jsAsyncActions)
        },
      )
    })

    // update nft.json files to include prisma files (only for next.js)
    compiler.hooks.compilation.tap('PrismaPlugin', (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: 'PrismaPlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_ANALYSE,
        },
        async (assets) => {
          const nftAssetNames = Object.keys(assets).filter((k) => k.endsWith('.nft.json'))
          const nftAsyncActions = nftAssetNames.map((assetName) => {
            // prepare paths
            const outputDir = compiler.outputPath
            const assetPath = path.resolve(outputDir, assetName)
            const assetDir = path.dirname(assetPath)

            // get sources
            const sourceAsset = compilation.getAsset(assetName)
            let sourceContents = sourceAsset.source.source() + ''
            const ntfLoadedAsJson = JSON.parse(sourceContents)

            // update sources
            Object.values(prismaCopyMap)
              .flatMap((v) => Object.entries(v))
              .forEach(([from, dest]) => {
                ntfLoadedAsJson.files.push(path.relative(assetDir, dest))
              })

            // persist sources
            sourceContents = JSON.stringify(ntfLoadedAsJson)
            const newRawSource = new sources.RawSource(sourceContents)
            compilation.updateAsset(assetName, newRawSource)
          })

          await Promise.all(nftAsyncActions)
        },
      )
    })

    // copy prisma files to output as the final step (for all users)
    compiler.hooks.done.tapPromise('PrismaPlugin', async () => {
      for (const fromDestMap of Object.values(prismaCopyMap)) {
        for (const [from, dest] of Object.entries(fromDestMap)) {
          // only copy if file doesn't exist, useful for watch mode
          if ((await fs.access(dest).catch(() => false)) === false) {
            await fs.copyFile(from, dest)
          }
        }
      }
    })
  }
}

module.exports = { PrismaPlugin }
