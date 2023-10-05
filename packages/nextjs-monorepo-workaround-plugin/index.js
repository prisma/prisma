// @ts-check

const path = require('path')
const fs = require('fs/promises')

// when client is bundled this gets its output path
// regex works both on escaped and non-escaped code
const prismaDirRegex =
  /\\?"?output\\?"?:\s*{(?:\\n?|\s)*\\?"?value\\?"?:(?:\\n?|\s)*\\?"(.*?)\\?",(?:\\n?|\s)*\\?"?fromEnvVar\\?"?/g

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
  const filterRegex = /schema\.prisma|engine/
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

    const originAssetsToCopies = {} // { [original]: [dest1, dest2, ...] }
    const origins = []

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
            const oldSourceAsset = compilation.getAsset(assetName)
            const oldSourceContents = oldSourceAsset.source.source() + ''

            // update sources
            for (const match of oldSourceContents.matchAll(prismaDirRegex)) {
              const prismaDir = await getPrismaDir(match[1])
              const prismaFiles = await getPrismaFiles(match[1])

              prismaFiles.forEach((f) => {
                // build the asset original path
                const from = path.join(prismaDir, f)
                // look for an existing origin to get its index (origin = prisma directory)
                const originIndexLookup = origins.indexOf(prismaDir)
                const originIndex =
                  originIndexLookup !== -1
                    ? // if origin exist, take the index as the unique key for this origin,
                      originIndexLookup
                    : // else push the new origin and get it's index as well
                      // (push returns new length of the array, we subtract 1 to get 0-based index)
                      origins.push(prismaDir) - 1
                // get the existing copies for this origin asset or set to an empty array
                const assetCopies = (originAssetsToCopies[from] = originAssetsToCopies[from] || [])

                // build the copy filename
                // only the schema.prisma asset filename should be suffixed by originIndex
                // as the rest should be the same across all the origins
                const copyFilename = f === 'schema.prisma' ? `${f}${originIndex}` : f
                // build the copy path by appending filename to the destination folder
                // (where the asset we are copying this for will be emitted)
                const copyPath = path.join(assetDir, copyFilename)
                // if this copy is new for the origin asset, we add it to the copies array
                if (!assetCopies.includes(copyPath)) {
                  assetCopies.push(copyPath)
                }

                // finally, we update the reference to schema.prisma file to point
                // to the updated filename in the emitted asset
                if (f === 'schema.prisma') {
                  // update "schema.prisma" to "schema.prisma{originIndex}" in the sources
                  const newSourceString = oldSourceContents.replace(/schema\.prisma/g, copyFilename)
                  const newRawSource = new sources.RawSource(newSourceString)
                  compilation.updateAsset(assetName, newRawSource)
                }
              })
            }
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
        (assets) => {
          const nftAssetNames = Object.keys(assets).filter((k) => k.endsWith('.nft.json'))
          nftAssetNames.forEach((assetName) => {
            // prepare paths
            const outputDir = compiler.outputPath
            const assetPath = path.resolve(outputDir, assetName)
            const assetDir = path.dirname(assetPath)

            // get sources
            const oldSourceAsset = compilation.getAsset(assetName)
            const oldSourceContents = oldSourceAsset.source.source() + ''
            const ntfLoadedAsJson = JSON.parse(oldSourceContents)

            // update sources
            Object.values(originAssetsToCopies).forEach((copies) => {
              const copiesPaths = copies.map((copy) => path.relative(assetDir, copy))
              ntfLoadedAsJson.files.push(...copiesPaths)
            })

            // persist sources
            const newSourceString = JSON.stringify(ntfLoadedAsJson)
            const newRawSource = new sources.RawSource(newSourceString)
            compilation.updateAsset(assetName, newRawSource)
          })

          return Promise.resolve()
        },
      )
    })

    // copy prisma files to output as the final step (for all users)
    compiler.hooks.done.tapPromise('PrismaPlugin', async () => {
      const asyncActions = Object.entries(originAssetsToCopies).map(async ([from, copies]) => {
        await Promise.all(
          copies.map(async (copy) => {
            // only copy if file doesn't exist, necessary for watch mode
            if ((await fs.access(copy).catch(() => false)) === false) {
              return fs.copyFile(from, copy)
            }
          }),
        )
      })

      await Promise.all(asyncActions)
    })
  }
}

module.exports = { PrismaPlugin }
