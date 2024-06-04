# Commands

## Run Tests

```
cd packages/client

# Driver Adapters pg only
pnpm run test:functional:code --preview-features driverAdapters --adapter js_pg /logging/tests.ts
pnpm run test:functional:code --preview-features driverAdapters --adapter js_pg /node-engine/test.ts

# Native driver only
pnpm run test:functional:code --preview-features driverAdapters --provider postgresql issues/11974/tests.ts
```

## Build in background

```
pnpm run watch
```

# Windows

1. Postgres: `cd docker` + `docker compose up postgres -d`
2. Watch: `pnpm run watch`
3. Sandbox: `cd sandbox/node-engine` + `pnpm start`
4. Test: `cd packages/client` + `pnpm run test:functional:code --preview-features driverAdapters --adapter js_pg /node-engine/test.ts`

```ts
/*
{
  query: {
    modelName: 'One',
    action: 'findMany',
    query: {
      arguments: {},
      selection: {
        '$composites': true,
        '$scalars': true,
        two: {
          arguments: {},
          selection: {
            '$composites': true,
            '$scalars': true,
            three: {
              arguments: {},
              selection: { '$composites': true, '$scalars': true, four: true }
            }
          }
        }
      }
    }
  }
}
*/
  plan() {
    if (this._getRelationSelection(this.query.query.selection)) {
      const cutRelationSelection = "two"
      /*
      {
        query: {
          modelName: 'One',
          action: 'findMany',
          query: {
            arguments: {},
            selection: {
              '$composites': true,
              '$scalars': true,
            }
          }
        }
      }
      */
      const thisLevelSimplifiedQuery = {}
      const thisLevelData = this.plan()
      const subIds = [2]

      /*
      {
        query: {
          modelName: 'Two',
          action: 'findMany',
          query: {
            arguments: { where: { id: 2 } },
            selection: {
              '$composites': true,
              '$scalars': true,
              three: {
                arguments: {},
                selection: { '$composites': true, '$scalars': true, four: true }
              }
            }
          }
        }
      }
      */
      const otherLevelQueries = {}
      const otherLevelData = this.plan()

      thisLevelData[cutRelationSelection] = otherLevelData

      // put otherLevelData into thisLevelData
      return allData

    } else {
      this.buildSql()
      await this.runSQL()
      result = this.transformResult()
      return result
    }
  }
```
