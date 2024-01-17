import { ClientEngineType } from '@prisma/internals'

import { testGeneratedClient } from './common'

test('not-so-exhaustive-schema-mongo (library)', testGeneratedClient(ClientEngineType.Library))
