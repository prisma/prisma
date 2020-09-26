import * as IntegrationTest from '../../__helpers__/integrationTest'
import database from './database'
import scenarios from './scenarios'

IntegrationTest.runtime({
  database,
  scenarios,
})
