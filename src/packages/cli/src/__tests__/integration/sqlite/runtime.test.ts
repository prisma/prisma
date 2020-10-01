import { runtimeIntegrationTest } from '../../__helpers__/integrationTest'
import { database } from './__database'
import { scenarios } from './__scenarios'

runtimeIntegrationTest({ database, scenarios })
