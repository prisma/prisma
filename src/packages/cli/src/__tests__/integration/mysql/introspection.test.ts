import * as IntegrationTest from '../../__helpers__/integrationTest'
import { database } from './__database'
import { scenarios } from './__scenarios'

IntegrationTest.introspectionIntegrationTest({ scenarios, database })
