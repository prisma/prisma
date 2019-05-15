#!/usr/bin/env node
import program from 'commander'
import path from 'path'
import fs from 'fs-extra'
import { safeLoad } from 'js-yaml'
import { generateClient } from './generation/generateClient'
import { performance } from 'perf_hooks'
import chalk from 'chalk'

async function getPrismaYmlPath() {
  if (await fs.pathExists('prisma.yml')) {
    return 'prisma.yml'
  }

  const prismaPath = path.join(process.cwd(), 'prisma/prisma.yml')
  if (await fs.pathExists(prismaPath)) {
    return prismaPath
  }

  const parentPath = path.join(process.cwd(), '../prisma.yml')
  if (await fs.pathExists(parentPath)) {
    return parentPath
  }

  throw new Error(`Could not find prisma.yml`)
}

async function getDatamodelPath(config: string, configPath: string) {
  const yml = safeLoad(config)
  if (yml.datamodel) {
    const datamodelPath = path.resolve(yml.datamodel)
    if (await fs.pathExists(datamodelPath)) {
      return datamodelPath
    } else {
      throw new Error(`datamodel: ${yml.datamodel} provided in ${configPath} does not exist in ${datamodelPath}`)
    }
  }
  const potentialPath = path.join(path.dirname(configPath), 'datamodel.prisma')
  if (await fs.pathExists(potentialPath)) {
    return potentialPath
  }
  throw new Error(`${configPath} doesn't have a datamodel property`)
}

program.option(
  '-o, --output <dir>',
  'The output directory of Photon',
  path.join(process.cwd(), '/node_modules/@generated/photon'),
)
program.parse(process.argv)

async function main() {
  const ymlPath = await getPrismaYmlPath()
  const config = await fs.readFile(ymlPath, 'utf-8')
  const datamodelPath = await getDatamodelPath(config, ymlPath)
  const datamodel = await fs.readFile(datamodelPath, 'utf-8')
  const before = performance.now()
  console.log(`Generating Photon to ${program.output}`)
  await generateClient(datamodel, ymlPath, program.output, true)
  console.log(`Done generating Photon in ${(performance.now() - before).toFixed(2)}ms`)
  if (program.output) {
    console.log(`\nYou can import it with ${chalk.greenBright(`import { Photon } from '@generated/photon'`)}`)
  }
}

main().catch(console.error)
