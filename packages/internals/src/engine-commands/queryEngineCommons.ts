import chalk from 'chalk'
import * as E from 'fp-ts/Either'
import { identity, pipe } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/TaskEither'
import fs from 'fs'
import { match, P } from 'ts-pattern'

export function unlinkTempDatamodelPath(options: { datamodelPath?: string }, tempDatamodelPath: string | undefined) {
  return TE.tryCatch(
    () => {
      if (!options.datamodelPath && tempDatamodelPath) {
        return fs.promises.unlink(tempDatamodelPath)
      }

      return Promise.resolve(undefined)
    },
    (e) => ({
      type: 'unlink-temp-datamodel-path',
      reason: 'Unable to delete temporary datamodel path',
      error: e,
    }),
  )
}

export const createDebugErrorType =
  (debug: (formatter: any, ...args: any[]) => void, fnName: string) =>
  ({ type, reason, error }: { type: string; reason: string; error: Error }) => {
    debug(`error of type "${type}" in ${fnName}:\n`, { reason, error })
  }

function createSchemaValidationError(reason: string) {
  return `${chalk.redBright.bold('Prisma schema validation')} - ${reason}`
}

export type QueryEngineErrorInit = {
  // e.g., `Schema parsing - Error while interacting with query-engine-node-api library`
  reason: string

  // e.g., Error validating model "public": The model name \`public\` is invalid.
  message: string
} & (
  | {
      // parsed as JSON
      readonly _tag: 'parsed'

      // e.g., `P1012`
      errorCode?: string
    }
  | {
      // text
      readonly _tag: 'unparsed'
    }
)

export type ParseQueryEngineError = {
  errorOutput: string
  reason: string
}

/**
 * Parse the error output of getConfig / getDmmf, which follow the format convention of the query-engine methods.
 */
export function parseQueryEngineError({ errorOutput, reason }: ParseQueryEngineError): QueryEngineErrorInit {
  const actualError = pipe(
    E.tryCatch(
      () => JSON.parse(errorOutput),
      () => ({ _tag: 'unparsed' as const, message: errorOutput, reason }),
    ),
    E.map((errorOutputAsJSON: Record<string, string>) => {
      const defaultMessage = chalk.redBright(errorOutputAsJSON.message)
      const getConfigErrorInit = match(errorOutputAsJSON)
        .with({ error_code: 'P1012' }, (eJSON) => {
          return {
            reason: createSchemaValidationError(reason),
            errorCode: eJSON.error_code,
          }
        })
        .with({ error_code: P.string }, (eJSON) => {
          return {
            reason,
            errorCode: eJSON.error_code,
          }
        })
        .otherwise(() => {
          return {
            reason,
          }
        })

      return { _tag: 'parsed' as const, message: defaultMessage, ...getConfigErrorInit }
    }),
    E.getOrElseW(identity),
  )
  return actualError
}
