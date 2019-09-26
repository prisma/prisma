import ansiEscapes = require('ansi-escapes')
import { Box, Color, Instance, render } from 'ink'
import Spinner from 'ink-spinner'
const AnySpinner: any = Spinner
import {
  BorderBox,
  DummySelectable,
  ErrorBox,
  InkLink,
  TabIndexContext,
  TabIndexProvider,
} from '@prisma/ink-components'
import chalk from 'chalk'
import React, { useContext, useState } from 'react'
import { LiftPanic } from '../LiftEngine'
import { Link } from './Link'
import { sendPanic } from './sendPanic'

export async function handlePanic(error: LiftPanic, cliVersion: string, binaryVersion: string): Promise<boolean> {
  return new Promise(resolve => {
    let app: Instance | undefined

    const onDone = () => {
      if (app) {
        app.unmount()
        app.waitUntilExit()
      }
      process.exit(0)
      resolve()
    }

    app = render(
      <TabIndexProvider>
        <PanicDialog error={error} onDone={onDone} cliVersion={cliVersion} binaryVersion={binaryVersion} />
      </TabIndexProvider>,
    )
  })
}

interface DialogProps {
  error: LiftPanic
  cliVersion: string
  binaryVersion: string
  onDone: () => void
}

const PanicDialog: React.FC<DialogProps> = ({ error, onDone, cliVersion, binaryVersion }) => {
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const tabIndexContext = useContext(TabIndexContext)

  const onSubmit = async (submit: boolean) => {
    // upload this
    if (!submit) {
      process.exit(1)
    }
    setSending(true)
    tabIndexContext.lockNavigation(true)
    await sendPanic(error, cliVersion, binaryVersion)
    setDone(true)
    onDone()
  }

  return (
    <Box flexDirection="column">
      {done ? (
        <Color bold>We successfully received the error report. Thanks a lot for your help! 🙏</Color>
      ) : (
        <>
          <ErrorBox>Oops, an unexpected error occured!</ErrorBox>
          <Color bold>Please help us improve Prisma 2 by submitting an error report.</Color>
          <Color bold>Error reports never contain personal or other sensitive information.</Color>
          <Color dim>
            Learn more: <InkLink url="https://pris.ly/d/telemetry.md" />
          </Color>
          <BorderBox flexDirection="column" title={chalk.bold('Submit error report')} marginTop={1}>
            {sending ? (
              <DummySelectable tabIndex={0}>
                <Color cyan>
                  <AnySpinner /> Submitting error report
                </Color>
              </DummySelectable>
            ) : (
              <Link label="Yes" description={`Send error report once`} tabIndex={0} onSelect={() => onSubmit(true)} />
            )}
            <Link label="No" description={`Don't send error report`} tabIndex={1} onSelect={() => onSubmit(false)} />
          </BorderBox>
        </>
      )}
    </Box>
  )
}
