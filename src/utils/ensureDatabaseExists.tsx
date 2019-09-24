import { getSchema } from '@prisma/cli'
import { BorderBox, DummySelectable, TabIndexProvider } from '@prisma/ink-components'
import { getConfig } from '@prisma/photon'
import ansiEscapes from 'ansi-escapes'
import chalk from 'chalk'
import { Box, Color, Instance, render } from 'ink'
import Spinner from 'ink-spinner'
import React, { useState } from 'react'
import { createDatabase } from '..'
import { canConnectToDatabase } from '../liftEngineCommands'
import { Link } from './Link'
import { DatabaseCredentials, uriToCredentials } from './uriToCredentials'
const AnySpinner: any = Spinner

export type LiftAction = 'create' | 'apply' | 'unapply' | 'dev'

export async function ensureDatabaseExists(action: LiftAction, forceCreate: boolean = false) {
  const datamodel = await getSchema()
  const config = await getConfig(datamodel)
  const activeDatasource =
    config.datasources.length === 1
      ? config.datasources[0]
      : config.datasources.find(d => d.config.enabled === 'true') || config.datasources[0]

  if (!activeDatasource) {
    throw new Error(`Couldn't find a datasource in the schema.prisma file`)
  }

  const { status } = await canConnectToDatabase(activeDatasource.url.value)
  if (status === 'Ok') {
    return
  }

  if (forceCreate) {
    await createDatabase(activeDatasource.url.value)
  } else {
    await interactivelyCreateDatabase(activeDatasource.url.value, action)
  }
}

export async function interactivelyCreateDatabase(connectionString: string, action: LiftAction): Promise<void> {
  await askToCreateDb(connectionString, action)
}

export async function askToCreateDb(connectionString: string, action: LiftAction): Promise<void> {
  return new Promise(resolve => {
    let app: Instance | undefined

    const onDone = () => {
      if (app) {
        app.unmount()
        app.waitUntilExit()
      }
      // .write as console.log introduces an unwanted linebreak here
      process.stdout.write(ansiEscapes.eraseLines(11)) // height of the dialog
      resolve()
    }

    app = render(
      <TabIndexProvider>
        <CreateDatabaseDialog connectionString={connectionString} action={action} onDone={onDone} />
      </TabIndexProvider>,
    )
  })
}

interface DialogProps {
  connectionString: string
  action: LiftAction
  onDone: () => void
}

const CreateDatabaseDialog: React.FC<DialogProps> = ({ connectionString, action, onDone }) => {
  const [creating, setCreating] = useState(false)
  async function onSelect(shouldCreate: boolean) {
    if (shouldCreate) {
      setCreating(true)
      await createDatabase(connectionString)
      setCreating(false)
      onDone()
    } else {
      process.exit(0)
    }
  }
  const credentials = uriToCredentials(connectionString)
  const dbName = credentials.database
  const dbType =
    credentials.type === 'mysql'
      ? 'MySQL'
      : credentials.type === 'postgres'
      ? 'PostgreSQL'
      : credentials.type === 'sqlite'
      ? 'Sqlite'
      : credentials.type

  const schemaWord = 'database'

  return (
    <Box flexDirection="column">
      <Box flexDirection="column">
        {action === 'dev' ? (
          <Color>
            You are trying to run <Color bold>prisma2 dev</Color> for {dbType} {schemaWord} <Color bold>{dbName}</Color>
            .
          </Color>
        ) : (
          <Color>
            You are trying to {action} a migration for {dbType} {schemaWord} <Color bold>{dbName}</Color>.
          </Color>
        )}
        <Color>
          A {schemaWord} with that name doesn't exist at <Color bold>{getDbLocation(credentials)}</Color>.
        </Color>
        <Color>Do you want to create the {schemaWord}?</Color>
      </Box>
      <BorderBox flexDirection="column" title={chalk.bold('Database options')} marginTop={1}>
        {creating ? (
          <DummySelectable tabIndex={0}>
            <Color cyan>
              <AnySpinner /> Creating {schemaWord} <Color bold>{dbName}</Color>
            </Color>
          </DummySelectable>
        ) : (
          <Link
            label="Yes"
            description={`Create new ${dbType} ${schemaWord} ${chalk.bold(dbName!)}`}
            tabIndex={0}
            onSelect={() => onSelect(true)}
          />
        )}
        <Link label="No" description={`Don't create the ${schemaWord}`} tabIndex={1} onSelect={() => onSelect(false)} />
      </BorderBox>
    </Box>
  )
}

function getDbLocation(credentials: DatabaseCredentials): string {
  if (credentials.type === 'sqlite') {
    return credentials.uri!
  }

  return `${credentials.host}:${credentials.port}`
}
