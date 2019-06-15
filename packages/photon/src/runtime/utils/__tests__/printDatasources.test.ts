import { Dictionary } from '../common'
import { Datasource, InternalDatasource, printDatasources } from '../printDatasources'

const internalDatasources: InternalDatasource[] = [
  {
    config: {
      default: true,
    },
    name: 'db',
    connectorType: 'sqlite',
    url: 'file:db.db',
  },
]

test('empty override', () => {
  expect(printDatasources({}, internalDatasources)).toMatchInlineSnapshot(`
    "datasource db {
      provider = \\"sqlite\\"
      url      = \\"file:db.db\\"
      default  = true
    }"
  `)
})

test('url string override', () => {
  const override: Dictionary<Datasource> = {
    db: 'file:another.db',
  }

  expect(printDatasources(override, internalDatasources)).toMatchInlineSnapshot(`
    "datasource db {
      provider = \\"sqlite\\"
      url      = \\"file:another.db\\"
      default  = true
    }"
  `)
})

test('object with url override', () => {
  const override: Dictionary<Datasource> = {
    db: {
      url: 'file:even-another.db',
    },
  }

  expect(printDatasources(override, internalDatasources)).toMatchInlineSnapshot(`
    "datasource db {
      provider = \\"sqlite\\"
      url      = \\"file:even-another.db\\"
      default  = true
    }"
  `)
})

test('object with url and config override', () => {
  const override: Dictionary<Datasource> = {
    db: {
      url: 'file:even-another.db',
      default: false,
      another: 'thing',
    },
  }

  expect(printDatasources(override, internalDatasources)).toMatchInlineSnapshot(`
    "datasource db {
      provider = \\"sqlite\\"
      url      = \\"file:even-another.db\\"
      default  = true
    }"
  `)
})

test('multiple internal datasources', () => {
  const theInternalDatasources: InternalDatasource[] = [
    {
      config: {
        default: true,
      },
      name: 'db',
      connectorType: 'sqlite',
      url: 'file:db.db',
    },
    {
      config: {},
      name: 'db2',
      connectorType: 'sqlite',
      url: 'file:another-db.db',
    },
  ]

  expect(printDatasources({}, theInternalDatasources)).toMatchInlineSnapshot(`
    "datasource db {
      provider = \\"sqlite\\"
      url      = \\"file:db.db\\"
      default  = true
    }

    datasource db2 {
      provider = \\"sqlite\\"
      url      = \\"file:another-db.db\\"
    }"
  `)
})
