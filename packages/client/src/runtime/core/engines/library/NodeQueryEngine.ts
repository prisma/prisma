import { JsonFieldSelection } from '../common/types/JsonProtocol'

export class NodeQueryEngine {
  libraryEngine: any

  constructor(libraryEngine) {
    this.libraryEngine = libraryEngine
  }

  getModelFieldDefinitionByFieldX = (x, modelFields, resultFieldX) => {
    // console.log('getModelFieldDefinitionByFieldX by ', x, ' for ', resultFieldX)
    for (const modelField in modelFields) {
      if (Object.prototype.hasOwnProperty.call(modelFields, modelField)) {
        // console.log('-', modelField, modelFields[modelField])

        if (modelFields[modelField][x] == resultFieldX) {
          // console.log('modelFieldDefinition found: ', modelFields[modelField])
          return modelFields[modelField]
        }
      }
    }
  }
  getModelFieldDefinitionByFieldName = (modelFields, resultFieldName) => {
    return this.getModelFieldDefinitionByFieldX('name', modelFields, resultFieldName)
  }
  getModelFieldDefinitionByFieldRelatioName = (modelFields, resultFieldRelationName) => {
    return this.getModelFieldDefinitionByFieldX('relationName', modelFields, resultFieldRelationName)
  }
  getModelFieldDefinitionByFieldDbName = (modelFields, resultFieldDbName) => {
    return this.getModelFieldDefinitionByFieldX('dbName', modelFields, resultFieldDbName)
  }
  getModelFieldDefinitionByFieldIsId = (modelFields) => {
    return this.getModelFieldDefinitionByFieldX('isId', modelFields, true)
  }
  getTypeByFieldName = (modelDefinition, fieldName) => {
    // TODO make this make sense
    return { modelDefinition, fieldName }
  }
  getModelDefinition = (modelName) => {
    return this.libraryEngine.config._runtimeDataModel.models[modelName!]
  }

  async execute(query) {
    // console.log('Yes, NodeEngine!')
    console.dir({ query }, { depth: null })

    // "dmmf" like object that has information about datamodel
    // console.dir({ _runtimeDataModel: this.config._runtimeDataModel }, { depth: null })

    // get table name via "dmmf"
    const modelName = query.modelName
    const tableName = this.libraryEngine.config._runtimeDataModel.models[modelName!].dbName || modelName // dbName == @@map
    // console.log({tableName})

    // get model field data to work with
    // TODO consider @map
    const modelDefinition = this.getModelDefinition(modelName)
    const modelFields = modelDefinition.fields
    // console.log({modelFields})

    /* VALIDATE QUERY */
    if (query.query.arguments && query.query.arguments.where) {
      // WHERE
      const whereFields = query.query.arguments.where
      for (const whereField in whereFields) {
        if (Object.prototype.hasOwnProperty.call(whereFields, whereField)) {
          const whereFilter = whereFields[whereField]
          if ('equals' in whereFilter) {
            // equals only
            if (whereFilter.equals.$type == 'FieldRef') {
              // field-reference
              const referenceField = whereFilter.equals.value._ref
              const referenceModel = whereFilter.equals.value._container
              const whereFieldType = this.getModelFieldDefinitionByFieldName(modelFields, whereField).type
              const referenceFieldType = this.getModelFieldDefinitionByFieldName(modelFields, referenceField).type
              if (whereFieldType != referenceFieldType) {
                const error = {
                  errors: [
                    {
                      error: '...',
                      user_facing_error: {
                        is_panic: false,
                        message: `Input error. Expected a referenced scalar field of type ${whereFieldType} but found ${referenceModel}.${referenceField} of type ${referenceFieldType}.`,
                        meta: {
                          // "details": "Expected a referenced scalar field of type String but found Product.notString of type Int."
                        },
                        error_code: 'P2019',
                      },
                    },
                  ],
                }
                return error
              }
            }
          }
        }
      }
    }

    /* CRAFT SQL */

    let sql = ''

    if (query.query.selection._count) {
      sql = this.handleCountAggregations(query, modelFields, tableName)
    } else if (query.query.arguments.where) {
      // WHERE
      console.log('WHERE!')
      /*
        {
          query: {
            modelName: 'Resource',
            action: 'findMany',
            query: {
              arguments: {
                where: { requiredJson: { path: [ 'bar', 'baz' ], equals: 'qux' } }
              },
              selection: { '$composites': true, '$scalars': true }
            }
          }
        }
      */
      /*
        Query: SELECT "public"."Resource"."id", "public"."Resource"."requiredJson", "public"."Resource"."optionalJson" 
          FROM "public"."Resource" 
          WHERE ("public"."Resource"."requiredJson"#>ARRAY[$1, $2]::text[])::jsonb::jsonb = $3 
          OFFSET $4
        Params: ["bar","baz","qux",0]
      */
      const whereFields = query.query.arguments.where
      let whereString = ''
      for (const whereField in whereFields) {
        if (Object.prototype.hasOwnProperty.call(whereFields, whereField)) {
          // TODO Actually handle multple fields in where instead of overwriting the `whereString` in the loop

          const whereFilter = whereFields[whereField]
          if (typeof whereFilter === 'string') {
            whereString = `WHERE "${tableName}"."${whereField}" = '${whereFilter}'`
            // TODO Below Consider only for Json fields
          } else if ('path' in whereFilter && 'equals' in whereFilter) {
            // path + equals
            whereString = `WHERE ("${tableName}"."${whereField}"#>ARRAY['${whereFilter.path.join(
              "','",
            )}']::text[])::jsonb::jsonb = '"${whereFilter.equals}"'`
          } else if ('equals' in whereFilter) {
            // equals only
            if (whereFilter.equals.$type == 'FieldRef') {
              // field-reference
              /*
                where: {
                  string: {
                    equals: {
                      '$type': 'FieldRef',
                      value: { _ref: 'otherString', _container: 'Product' }
                    }
                  }
                }

                SELECT ...
                FROM "public"."Product"
                WHERE "public"."Product"."string" = "public"."Product"."otherString"
                  OFFSET $1
              */
              const referenceField = whereFilter.equals.value._ref
              const referenceModel = whereFilter.equals.value._container
              whereString = `WHERE "${tableName}"."${whereField}" = "${referenceModel}"."${referenceField}"`
            } else {
              // normal value (not a field-reference)
              const fieldDefinition = this.getModelFieldDefinitionByFieldName(modelFields, whereField)
              // console.log({fieldDefinition})
              if (fieldDefinition.type == 'Json') {
                whereString = `WHERE "${tableName}"."${whereField}"::jsonb = '${JSON.stringify(whereFilter.equals)}'`
              } else {
                whereString = `WHERE "${tableName}"."${whereField}" = '${whereFilter.equals}'`
              }
            }
          } else if ('not' in whereFilter) {
            // not only
            whereString = `WHERE "${tableName}"."${whereField}"::jsonb <> '${JSON.stringify(whereFilter.not)}'`
          } else if ('startsWith' in whereFilter) {
            /*
            where: {
              string: {
                startsWith: {
                  '$type': 'FieldRef',
                  value: { _ref: 'otherString', _container: 'Product' }
                }
              }
            }

            SELECT ...
            FROM "public"."Product"
            WHERE "public"."Product"."string"::text LIKE ("public"."Product"."otherString" || '%')
              OFFSET $1
            */
            const referenceField = whereFilter.startsWith.value._ref
            const referenceModel = whereFilter.startsWith.value._container
            whereString = `WHERE "${tableName}"."${whereField}"::text LIKE ("${referenceModel}"."${referenceField}" || '%')`
          }
          // TODO handle other cases (only path etc)
        }
      }

      sql = `SELECT * 
              FROM "${tableName}"
              ${whereString}
            `
    } else if (query.query.arguments.cursor) {
      // CURSOR
      console.log('CURSOR!')
      /*
        query: {
          arguments: {
            cursor: { id: '02ad3e6df869f486f75a4833', title: 'Hello World 2' }
          },
        }

        SELECT *
        FROM "public"."Post"
        WHERE "public"."Post"."id" >=
            (SELECT "public"."Post"."id"
            FROM "public"."Post"
            WHERE ("public"."Post"."id",
                    "public"."Post"."title") = ($1,$2))
        ORDER BY "public"."Post"."id" ASC
        OFFSET $3
      */
      const cursorField = Object.keys(query.query.arguments.cursor)[0]
      const columns = Object.keys(query.query.arguments.cursor)
        .map((field) => `"${tableName}"."${field}"`)
        .join(', ')
      const values = Object.values(query.query.arguments.cursor)
        .map((value) => `'${value}'`)
        .join(', ')
      const whereString = `WHERE "${tableName}"."${cursorField}" >= 
                            (SELECT "${tableName}"."${cursorField}" FROM "${tableName}" WHERE (${columns}) = (${values})) 
                            ORDER BY "${tableName}"."${cursorField}" ASC`
      sql = `SELECT * 
              FROM "${tableName}"
              ${whereString}
            `
    } else {
      sql = `SELECT * FROM "${tableName}"`
    }
    // console.log({sql})

    try {
      const result = await this.libraryEngine.adapter.queryRaw({ sql, args: [] })
      console.dir({ result }, { depth: null })

      // LOG SQL
      if (this.libraryEngine.logQueries) {
        this.libraryEngine.logEmitter.emit('query', {
          timestamp: new Date(),
          query: sql,
          params: 'none', // TODO params
          duration: Number(0), // TODO measure above
          target: 'huh?', // TODO what is this even?
        })
      }
      console.log('nodeQuery', sql)

      // INTERNAL: combine separated keys and values from driver adapter
      const combinedResult = result.value.rows.map((row) => {
        const obj = {}
        result.value.columnNames.forEach((colName, index) => {
          obj[colName] = row[index]
        })
        return obj
      })
      // console.log({combinedResult})

      // RESULT VALUE TYPE INDICATION
      // turn returned data into expected format (with type indications for casting in /packages/client/src/runtime/core/jsonProtocol/deserializeJsonResponse.ts)
      // TODO Long term most of this should not be necessary at all, as it is just from a to b and then back to a
      let transformedData = combinedResult.map((resultRow) => {
        // iterate over all fields of the row
        for (const resultFieldName in resultRow) {
          if (Object.prototype.hasOwnProperty.call(resultRow, resultFieldName)) {
            // console.dir(`${resultFieldName}: ${resultRow[resultFieldName]}`);

            const modelFieldDefinition = this.getModelFieldDefinitionByFieldName(modelFields, resultFieldName)
            if (modelFieldDefinition) {
              const type = modelFieldDefinition.type
              if (resultRow[resultFieldName] != null) {
                // field is not empty
                if (type == 'DateTime') {
                  resultRow[resultFieldName] = { $type: 'DateTime', value: resultRow[resultFieldName] }
                } else if (type == 'BigInt') {
                  resultRow[resultFieldName] = { $type: 'BigInt', value: resultRow[resultFieldName] }
                } else if (type == 'Bytes') {
                  resultRow[resultFieldName] = { $type: 'Bytes', value: resultRow[resultFieldName] }
                } else if (type == 'Decimal') {
                  resultRow[resultFieldName] = { $type: 'Decimal', value: resultRow[resultFieldName] }
                } else if (type == 'Json') {
                  resultRow[resultFieldName] = { $type: 'Json', value: resultRow[resultFieldName] }
                }
              }
            }
          }
        }

        return resultRow
      })

      // TRANSFORM AGGREGATIONS
      // console.log("data before transformation", transformedData)
      transformedData = transformedData.map((resultRow) => {
        for (const resultFieldName in resultRow) {
          if (Object.prototype.hasOwnProperty.call(resultRow, resultFieldName)) {
            // console.dir(`${resultFieldName}: ${resultRow[resultFieldName]}`);

            // _count
            if (resultFieldName.startsWith('_aggr_count_')) {
              const countKey = resultFieldName.replace('_aggr_count_', '')
              if (!resultRow._count) {
                resultRow._count = {}
              }
              resultRow._count[countKey] = Number(resultRow[resultFieldName])
              delete resultRow[resultFieldName]
            }
          }
        }
        return resultRow
      })
      // console.log("data before transformation", transformedData)

      // @map FIELD RENAMING
      // console.log({ modelFields })
      transformedData = transformedData.map((resultRow) => {
        for (const resultFieldName in resultRow) {
          if (Object.prototype.hasOwnProperty.call(resultRow, resultFieldName)) {
            // console.dir(`${key}: ${row[key]}`);

            const modelFieldDefinition = this.getModelFieldDefinitionByFieldDbName(modelFields, resultFieldName)
            // console.log({ modelFieldDefinition })
            if (modelFieldDefinition && modelFieldDefinition.name) {
              // TODO do this in a way that the order of fields is not changed
              resultRow[modelFieldDefinition.name] = resultRow[resultFieldName]
              delete resultRow[resultFieldName]
            }
          }
        }
        return resultRow
      })

      // DISTINCT
      if (query.query.arguments.distinct) {
        const distinctKey = query.query.arguments.distinct
        console.log('distinct', distinctKey)
        const distinctValues = {}
        console.log('before', transformedData)
        transformedData = transformedData.filter((resultRow) => {
          const getCombinedDistinctValues = (obj, keys) =>
            typeof keys === 'string'
              ? obj[keys] || ''
              : Array.isArray(keys)
              ? keys.map((key) => obj[key] || '').join('')
              : ''
          const distinctValueString = getCombinedDistinctValues(resultRow, distinctKey)
          if (!distinctValues[distinctValueString]) {
            distinctValues[distinctValueString] = true
            return true // Keep this row
          }
          return false // Filter out this row
        })
        console.log('after', transformedData)
      }

      // Return final data
      return [transformedData]
    } catch (error) {
      throw new Error(error)
    }
  }

  handleCountAggregations(query: any, modelFields: any, tableName: any) {
    /*
      model Link {
        id        String   @id @default(uuid())
        user      User?    @relation(fields: [userId], references: [id])
        userId    String?
      }
      model User {
        id        String    @id @default(uuid())
        links     Link[]
      }

      =>
      _count: { arguments: {}, selection: { links: true } }
    */

    const selections = Object.keys((query.query.selection._count as JsonFieldSelection).selection)

    // arrays to store generated data to add to the SQL statement
    const _additionalSelections: String[] = []
    const _additionalJoins: String[] = []

    // loop over all selections
    // const relationToCount = selections[0] // 'links`
    for (let i = 0; i < selections.length; i++) {
      const relationToCount = selections[i]
      // get information from current model
      const relationToCountFieldDefinition = this.getModelFieldDefinitionByFieldName(modelFields, relationToCount) // links object

      // console.log({relationToCountFieldDefinition})
      // PART 1: additional selection string
      const relationToCountModelname = relationToCountFieldDefinition.type // 'Link'
      const relationToCountTablename = relationToCountModelname // TODO Actually get the table name for target model, not just the type of the relation
      const _selectionString = `COALESCE("aggr_selection_${i}_${relationToCountTablename}"."_aggr_count_${relationToCount}", 0) AS "_aggr_count_${relationToCount}"`
      _additionalSelections.push(_selectionString)

      // PART 2: additional JOIN
      // get information from model the relation points to
      const relationToCountModelFields =
        this.libraryEngine.config._runtimeDataModel.models[relationToCountModelname!].fields
      // console.dir({ relationToCountModelname, relationToCountModelFields }, { depth: null })
      const targetModelFieldDefinition = this.getModelFieldDefinitionByFieldRelatioName(
        relationToCountModelFields,
        relationToCountFieldDefinition.relationName,
      )
      const aggregationTargetType = targetModelFieldDefinition.type // 'User'
      const relationFromField = targetModelFieldDefinition.relationFromFields[0] // this only has content for 1-n, not m-n

      // console.log({ relationFromField })
      // primary key from first table for sql
      const aggregationTargetTypeIdField = this.getModelFieldDefinitionByFieldIsId(modelFields)
      // console.log({ aggregationTargetTypeIdField })
      const aggregationTargetTypeIdFieldName = aggregationTargetTypeIdField.name // User.uid

      // console.log( { aggregationTargetTypeIdFieldName })
      if (relationFromField) {
        // 1-n
        const _joinString = `LEFT JOIN
                    (SELECT "${relationToCountTablename}"."${relationFromField}",
                            COUNT(*) AS "_aggr_count_${relationToCount}"
                    FROM "${relationToCountTablename}"
                    WHERE 1=1
                    GROUP BY "${relationToCountTablename}"."${relationFromField}") 
                      AS "aggr_selection_${i}_${relationToCountTablename}" 
                      ON ("${aggregationTargetType}".${aggregationTargetTypeIdFieldName} = "aggr_selection_${i}_${relationToCountTablename}"."${relationFromField}")
              `
        _additionalJoins.push(_joinString)
      } else {
        // m-n
        // need to get the primary key so we can properly join
        const relationToCountTypeIdField = this.getModelFieldDefinitionByFieldIsId(relationToCountModelFields) // User details
        console.log({ relationToCountTypeIdField })
        const relationToCountTypeIdFieldName = relationToCountTypeIdField.name // User.uid
        console.log({ relationToCountTypeIdFieldName })

        // Correctly select A and B to match model/table names of relation
        const char1 = relationToCountTablename.charAt(0)
        const char2 = tableName.charAt(0)
        const [mainForeignKeyName, otherForeignKeyName] =
          char1.charCodeAt(0) < char2.charCodeAt(0) ? ['B', 'A'] : ['A', 'B']

        const _joinString = `
                  LEFT JOIN
                    (SELECT "_${relationToCountFieldDefinition.relationName}"."${mainForeignKeyName}",
                            COUNT(("_${relationToCountFieldDefinition.relationName}"."${mainForeignKeyName}")) AS "_aggr_count_${relationToCount}"
                      FROM "${relationToCountTablename}"
                      LEFT JOIN "_${relationToCountFieldDefinition.relationName}" ON ("${relationToCountTablename}"."${relationToCountTypeIdFieldName}" = ("_${relationToCountFieldDefinition.relationName}"."${otherForeignKeyName}"))
                      WHERE 1=1
                      GROUP BY "_${relationToCountFieldDefinition.relationName}"."${mainForeignKeyName}") 
                        AS "aggr_selection_${i}_${relationToCountTablename}" 
                        ON ("${aggregationTargetType}"."${aggregationTargetTypeIdFieldName}" = "aggr_selection_${i}_${relationToCountTablename}"."${mainForeignKeyName}")
            `
        _additionalJoins.push(_joinString)
      }
    }

    const sql = `SELECT "${tableName}".*, 
              ${_additionalSelections.join(',\n')}
            FROM "${tableName}"
              ${_additionalJoins.join('\n')}
            WHERE 1=1
              OFFSET 0`
    return sql
  }
}
