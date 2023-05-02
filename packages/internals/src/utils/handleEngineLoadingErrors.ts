import { link, type PlatformWithOSResult } from '@prisma/get-platform'
import { dim } from 'kleur/colors'
import { match } from 'ts-pattern'

type HandleLibraryLoadingErrorsInput = {
  e: Error
  platformInfo: PlatformWithOSResult
  id: string
}

export function handleLibraryLoadingErrors(args: HandleLibraryLoadingErrorsInput): string {
  const error = args.e as Error & { code?: string }

  const systemLibraryNotFound = (library: string) =>
    `Prisma cannot find the required \`${library}\` system library in your system`
  const hasLinkingProblem = error.message.includes('cannot open shared object file')
  const referToSystemRequirementsDocs = `Please refer to the documentation about Prisma's system requirements: ${link(
    'https://pris.ly/d/system-requirements',
  )}`

  const errorTitle = `Unable to require(\`${dim(args.id)}\`).`

  const potentialReasonMessage = match({ message: error.message, code: error.code })
    .with({ code: 'ENOENT' }, () => `File does not exist.`)
    .when(
      ({ message }) => hasLinkingProblem && message.includes('libz'),
      () => {
        return `${systemLibraryNotFound('libz')}. Please install it and try again.`
      },
    )
    .when(
      ({ message }) => hasLinkingProblem && message.includes('libgcc_s'),
      () => {
        return `${systemLibraryNotFound('libgcc_s')}. Please install it and try again.`
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

  /**
   * Example:
   *
   * Error: Unable to require(`/usr/src/app/node_modules/@prisma/engines/libquery_engine-linux-arm64-openssl-1.0.x.so.node`)
   * Prisma has detected an incompatible version of the \`glibc\` C standard library installed in your system. This probably means your system may be too old to run Prisma. Please refer to the documentation about Prisma's system requirements: https://pris.ly/d/system-requirements
   *
   * Details: symbol __cxa_thread_atexit_impl, version GLIBC_2.18 not defined in file libc.so.6 with link time reference
   *      at load (/usr/src/app/node_modules/prisma/build/index.js:93185:11)
   *      at getEngineVersion (/usr/src/app/node_modules/prisma/build/index.js:93485:16)
   *      at runMicrotasks (<anonymous>)
   *      at processTicksAndRejections (internal/process/task_queues.js:95:5)
   */
  return `${errorTitle}
${potentialReasonMessage}

Details: ${error.message}`
}
