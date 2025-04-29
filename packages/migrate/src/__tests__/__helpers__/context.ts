import { jestConsoleContext, jestContext, jestStdoutContext, processExitContext } from '@prisma/get-platform'

import { configContextContributor } from './prismaConfig'
import { stdoutNormalizationRules } from './stdoutNormalizationRules'

export const createDefaultTestContext = () =>
  jestContext
    .new()
    .add(jestConsoleContext())
    .add(jestStdoutContext(stdoutNormalizationRules))
    .add(configContextContributor())
    .add(processExitContext())
    .assemble()
