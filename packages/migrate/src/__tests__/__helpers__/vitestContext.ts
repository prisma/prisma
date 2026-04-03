import {
  vitestConsoleContext,
  vitestContext,
  vitestProcessExitContext,
  vitestStdoutContext,
} from '@prisma/get-platform/src/test-utils/vitestContext'

import { configContextContributor } from './prismaConfig'
import { stdoutNormalizationRules } from './stdoutNormalizationRules'

export const createDefaultVitestContext = () =>
  vitestContext
    .new()
    .add(vitestConsoleContext())
    .add(vitestStdoutContext(stdoutNormalizationRules))
    .add(configContextContributor())
    .add(vitestProcessExitContext())
    .assemble()
