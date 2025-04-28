import { jestConsoleContext, jestContext, jestStdoutContext } from '@prisma/get-platform'

import { configContextContributor } from './prismaConfig'
import { stdoutNormalizationRules } from './stdoutNormalizationRules'

export const createDefaultTestContext = () =>
  jestContext
    .new()
    .add(jestConsoleContext())
    .add(jestStdoutContext(stdoutNormalizationRules))
    .add(configContextContributor())
    .assemble()
