import { Count } from './Count'
import { GenerateContext } from './GenerateContext'

export function createCountTypesFile(context: GenerateContext): string {
  const countTypes: Count[] = context.dmmf.schema.outputObjectTypes.prisma
    ?.filter((t) => t.name.endsWith('CountOutputType'))
    .map((t) => new Count(t, context))

  return `import * as runtime from '${context.nestedRuntimeJsPath}';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result
import Decimal = runtime.Decimal
import DecimalJsLike = runtime.DecimalJsLike

import type * as Prisma from '../common'

${countTypes.map((t) => t.toTS()).join('\n')}
`
}
