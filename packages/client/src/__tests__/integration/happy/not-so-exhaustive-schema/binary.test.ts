import { ClientEngineType } from '@prisma/internals'

import { testGeneratedClient } from './common'

test('not-so-exhaustive-schema (binary)', testGeneratedClient(ClientEngineType.Binary))
