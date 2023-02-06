import { link, type PlatformWithOSResult } from '@prisma/get-platform'
import chalk from 'chalk'
import { match } from 'ts-pattern'

type HandleLibraryLoadingErrorsInput = {
  e: Error
  platformInfo: PlatformWithOSResult
  libQueryEnginePath: string
}

export function handleLibraryLoadingErrors(args: HandleLibraryLoadingErrorsInput) {
  const error = args.e as Error & { code?: string }

  const systemLibraryNotFound = (library: string) =>
    `Prisma cannot find the required \`${library}\` system library in your system`
  const hasLinkingProblem = error.message.includes('cannot open shared object file')
  const referToSystemRequirementsDocs = `Please refer to the documentation about Prisma's system requirements: ${link(
    'https://pris.ly/d/system-requirements',
  )}`

  const defaultErrorMessage = `Unable to load Node-API Library from ${chalk.dim(args.libQueryEnginePath)}.`

  const potentialReasonMessage = match({ message: error.message, code: error.code })
    .with({ code: 'ENOENT' }, () => `File does not exist.`)
    .when(
      ({ message }) => hasLinkingProblem && message.includes('libz'),
      () => {
        return `${systemLibraryNotFound('libz')}. Please install it and try again.`
      },
    )
    .when(
      ({ message }) => hasLinkingProblem && message.includes('libcc_s'),
      () => {
        return `${systemLibraryNotFound('libcc_s')}. Please install it and try again.`
      },
    )
    .when(
      ({ message }) => hasLinkingProblem && message.includes('libssl'),
      () => {
        const libsslVersion = args.platformInfo.libssl ? `openssl-${args.platformInfo.libssl}` : 'openssl'
        return `${systemLibraryNotFound('libssl')}. Please install ${libsslVersion} and try again.`
      },
    )
    .when(
      ({ message }) => message.includes('GLIBC'),
      () => {
        return `Prisma has detected an incompatible version of the \`glibc\` C standard library installed in your system. This probably means your system may be too old to run Prisma. ${referToSystemRequirementsDocs}`
      },
    )
    .when(
      ({ message }) => args.platformInfo.platform === 'linux' && message.includes('symbol not found'),
      () => {
        return `The Prisma engines are not compatible with your system ${args.platformInfo.originalDistro} on (${args.platformInfo.archFromUname}) which uses the \`${args.platformInfo.binaryTarget}\` binaryTarget by default. ${referToSystemRequirementsDocs}`
      },
    )
    .otherwise(() => {
      return `The Prisma engines do not seem to be compatible with your system. ${referToSystemRequirementsDocs}`
    })

  return `${defaultErrorMessage} ${potentialReasonMessage}`
}
