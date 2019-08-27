import React, { useEffect, useState, useContext } from 'react'
import { Color, Box } from 'ink'
import { useInitState } from '../components/InitState'
import { beautifyLanguage } from '../utils/print'
import DownloadProgress from '../components/DownloadProgress'
import os from 'os'
import path from 'path'
import fetch from 'node-fetch'
import tar from 'tar'
import fs from 'fs'
import execa from 'execa'
import chalk from 'chalk'
import { useExampleApi } from '../utils/useExampleApi'
import { RouterContext } from '../components/Router'
import makeDir from 'make-dir'

const Step60DownloadExample: React.FC = () => {
  const [state] = useInitState()
  const [activeIndex, setActiveIndex] = useState(0)
  const [logs, setLogs] = useState('')
  const router = useContext(RouterContext)
  const examples = useExampleApi()

  const { selectedExample } = state

  if (!selectedExample) {
    return <Box>No example selected</Box>
  }

  const relativePath = path.relative(process.cwd(), state.outputDir) || '.'

  const builtInSteps = ['Downloading the starter kit from GitHub', `Extracting content to ${chalk.bold(relativePath)}`]

  // TODO: Remove .slice(0, 1) as soon as tmp-prepare is implemented
  const steps = [...builtInSteps, ...selectedExample.setupCommands.slice(0, 1).map(c => c.description)]

  useEffect(() => {
    async function prepare() {
      await makeDir(state.outputDir)
      const tarFile = await downloadRepo('prisma', 'prisma-examples', examples!.meta.branch)
      setActiveIndex(1)
      await extractExample(tarFile, selectedExample!.path, state.outputDir)
      setActiveIndex(2)
    }
    if (examples) {
      prepare()
    }
  }, [examples])

  useEffect(() => {
    async function doIt() {
      // TODO: Remove .slice(0, 1) as soon as tmp-prepare is implemented
      const step = selectedExample!.setupCommands.slice(0, 1)[activeIndex - 2]
      if (step) {
        await execa.shell(step.command, { stdio: 'ignore', cwd: state.outputDir })
        setActiveIndex(activeIndex + 1)
      } else {
        router.setRoute('success')
      }
    }
    if (examples && activeIndex > 1) {
      doIt() // because https://github.com/facebook/react/issues/14326#issuecomment-441680293
    }
  }, [examples, activeIndex])

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginBottom={1}>
        {state.useDemoScript ? (
          <Color>
            Preparing your demo script <Color bold>({beautifyLanguage(state.selectedLanguage!)})</Color> ...
          </Color>
        ) : (
          <Color>
            Preparing your starter kit: <Color bold>{selectedExample.name}</Color>
          </Color>
        )}
      </Box>
      <DownloadProgress steps={steps} activeIndex={activeIndex} />
      <Box>{logs}</Box>
    </Box>
  )
}

export default Step60DownloadExample

async function downloadRepo(organization: string, repo: string, branch: string): Promise<string> {
  const downloadUrl = `https://api.github.com/repos/${organization}/${repo}/tarball/${branch}` // TODO: use master instead of prisma2
  const tmpFile = getTmpFile(`prisma-download-${organization}-${repo}-${branch}.tar.gz`)
  const response = await fetch(downloadUrl, {
    headers: {
      'User-Agent': 'prisma/prisma-init',
    },
  })
  await new Promise((resolve, reject) => {
    response.body
      .pipe(fs.createWriteStream(tmpFile))
      .on('error', reject)
      .on('close', resolve)
  })
  return tmpFile
}

async function extractExample(tmpPath: string, examplePath: string, outputPath: string): Promise<void> {
  await tar.extract({
    file: tmpPath,
    cwd: outputPath,
    filter: filePath => RegExp(examplePath).test(filePath),
    strip: examplePath.split('/').length - 1,
  })
}

function getTmpFile(filename: string): string {
  const tmpDir = os.tmpdir()
  return path.join(tmpDir, filename)
}
