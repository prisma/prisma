import {
  DatabaseStep,
  RawSqlStep,
  DropTableStep,
  RenameTableStep,
  CreateTableStep,
} from '../types'
import cleur from './cleur'

export function printDatabaseSteps(
  databaseSteps: DatabaseStep[],
  short = false,
) {
  const intro = `Going to perform ${cleur.bold(
    databaseSteps.length,
  )} SQL statements.`

  if (short) {
    return (
      intro +
      `\n` +
      cleur.dim(
        `You can get the full overview with ${cleur.greenBright(
          'prisma lift up --verbose',
        )}`,
      )
    )
  }

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
  //   return `\n

  // 1)  ${ct} Blog with 3 columns

  // 2)  ${ct} Author with 2 columns

  // 3)  ${ct} Post with 4 columns, 1 foreign key, one primary column

  // 4)  ${ct} Post_tags with 3 columns, 2 primary columns

  // 5)  ${ct} _AuthorToBlog with 1 column

  // To get the full report, run "prisma lift up --verbose"
  // `
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
