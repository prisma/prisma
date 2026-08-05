import { engineDatasource } from '../../utils/engine-datasource'

const datasource = { url: 'postgresql://localhost:5432/main', shadowDatabaseUrl: 'postgresql://localhost:5432/shadow' }

test('leaves the datasource alone when no consent was given', () => {
  expect(engineDatasource(datasource, undefined)).toEqual(datasource)
  expect(engineDatasource(datasource, false)).toEqual(datasource)
})

test('carries the consent that was given', () => {
  expect(engineDatasource(datasource, true)).toEqual({ ...datasource, resetShadowDatabase: true })
})

test('carries consent given without a datasource to carry it on', () => {
  expect(engineDatasource(undefined, true)).toEqual({ resetShadowDatabase: true })
  expect(engineDatasource(undefined, false)).toBeUndefined()
})

test('the payload the engine receives spells the consent as its wire field', () => {
  expect(JSON.stringify(engineDatasource({ url: 'file:./dev.db' }, true))).toBe(
    '{"url":"file:./dev.db","resetShadowDatabase":true}',
  )
  expect(JSON.stringify(engineDatasource({ url: 'file:./dev.db' }, false))).toBe('{"url":"file:./dev.db"}')
})
