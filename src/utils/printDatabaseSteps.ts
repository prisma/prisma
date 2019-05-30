import {
  DatabaseStep,
  RawSqlStep,
  DropTableStep,
  RenameTableStep,
  CreateTableStep,
} from '../types'
import cleur from './cleur'
import { darkBrightBlue } from './highlightDatamodel'

export function printDatabaseSteps(
  databaseSteps: DatabaseStep[],
  short = true,
) {
  if (short) {
    const counts = getStepCounts(databaseSteps)
    const overview =
      Object.entries(counts)
        .reduce<string[]>((acc, [key, value]) => {
          if (value > 0) {
            acc.push(`${value} ${darkBrightBlue(key)}`)
          }

          return acc
        }, [])
        .join(', ') + ' statements.'
    return overview
  }

  const intro = `${cleur.bold(databaseSteps.length)} steps in total`

  return (
    intro +
    ':\n\n\n' +
    databaseSteps
      .map(
        (step, index) =>
          `  ${cleur.grey().dim(index + 1 + ')')} ${renderStep(step)}`,
      )
      .join('\n\n') +
    '\n'
  )
}

const bold = str => str

function renderStep(step: DatabaseStep) {
  if (isRawSqlStep(step)) {
    return `${bold('Raw SQL')} ${cleur.dim(step.RawSql)}`
  }
  if (isDropTableStep(step)) {
    return `${bold('Drop table')} ${cleur.bold().dim(step.DropTable.name)}`
  }
  if (isRenameTableStep(step)) {
    return `${bold('Rename table')} ${cleur.dim(
      step.RenameTable.name,
    )} ${cleur.dim('→')} ${cleur.dim(step.RenameTable.new_name)}`
  }
  if (isCreateTableStep(step)) {
    const foreignKeyCount = step.CreateTable.columns.filter(c => c.foreign_key)
      .length
    const primaryCount = step.CreateTable.primary_columns.length
    const foreignKeyStr =
      foreignKeyCount > 0 ? `, ${foreignKeyCount} foreign keys` : ''
    const primaryColumns = primaryCount > 0 ? `, ${primaryCount} primary` : ''
    return `${bold('Create table')} ${cleur
      .bold()
      .dim(step.CreateTable.name)}${cleur.dim(
      `, ${
        step.CreateTable.columns.length
      } columns${foreignKeyStr}${primaryColumns}`,
    )}`
  }
}

type StepCounts = {
  RawSql: number
  DropTable: number
  RenameTable: number
  CreateTable: number
}

function getStepCounts(databaseSteps: DatabaseStep[]): StepCounts {
  const stepCounts = {
    RawSql: 0,
    DropTable: 0,
    RenameTable: 0,
    CreateTable: 0,
  }

  for (const step of databaseSteps) {
    const key = Object.keys(step)[0]
    stepCounts[key]++
  }

  return stepCounts
}

function isRawSqlStep(databaseStep: DatabaseStep): databaseStep is RawSqlStep {
  return databaseStep.hasOwnProperty('RawSql')
}

function isDropTableStep(
  databaseStep: DatabaseStep,
): databaseStep is DropTableStep {
  return databaseStep.hasOwnProperty('DropTable')
}

function isRenameTableStep(
  databaseStep: DatabaseStep,
): databaseStep is RenameTableStep {
  return databaseStep.hasOwnProperty('RenameTable')
}

function isCreateTableStep(
  databaseStep: DatabaseStep,
): databaseStep is CreateTableStep {
  return databaseStep.hasOwnProperty('CreateTable')
}

const ct = cleur.bold('CreateTable')
