import { JsonFieldSelection } from '../common/types/JsonProtocol'

export class Query {
  query: any
  modelName: any
  tableName: any
  modelDefinition: any
  modelFields: any
  datamodel: any
  client: any
  libraryEngine: any

  constructor(query, datamodel, client, libraryEngine) {
    console.dir({ query }, { depth: null })
    this.query = query
    this.client = client
    this.datamodel = datamodel
    this.modelName = query.modelName
    this.tableName = datamodel.models[this.modelName]?.dbName ?? this.modelName // dbName == @@map
    this.modelDefinition = this._getModelDefinition(this.modelName)
    this.modelFields = this.modelDefinition.fields
    this.libraryEngine = libraryEngine

    // console.dir(datamodel.models, { depth: null })
  }

  /* Validate the query */
  validate() {
    // arguments.where
    if (this.query.query.arguments && this.query.query.arguments.where) {
      // WHERE
      const whereFields = this.query.query.arguments.where
      for (const whereField in whereFields) {
        if (Object.prototype.hasOwnProperty.call(whereFields, whereField)) {
          const whereFilter = whereFields[whereField]
          // where: { field: value }
          if (typeof whereFilter === 'string' || typeof whereFilter === 'number') {
            // nothing to do with string or number 'where'
            // where.equals
          } else if ('equals' in whereFilter) {
            // equals only
            if (whereFilter.equals.$type == 'FieldRef') {
              // field-reference
              const referenceField = whereFilter.equals.value._ref
              const referenceModel = whereFilter.equals.value._container
              const whereFieldType = this._getModelFieldDefinitionByFieldName(this.modelFields, whereField).type
              const referenceFieldType = this._getModelFieldDefinitionByFieldName(this.modelFields, referenceField).type

              if (this.modelName != referenceModel) {
                const errorMessage = `Input error. Expected a referenced scalar field of model ${this.modelName}, but found a field of model ${referenceModel}.`
                return this._createError('...', false, errorMessage, {}, 'P2019')
              } else if (whereFieldType != referenceFieldType) {
                const errorMessage = `Input error. Expected a referenced scalar field of type ${whereFieldType} but found ${referenceModel}.${referenceField} of type ${referenceFieldType}.`
                return this._createError('...', false, errorMessage, {}, 'P2019')
              }
            }
          }
          // TODO other whereFilters
        }
      }
    }
    return
  }

  /* Process the query: build SQL, run SQL, process result */
  async process() {
    /*
    original query
    {
      query: {
        modelName: 'One',
        action: 'findMany',
        query: {
          arguments: { where: { id: 1 } },
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
    console.dir(this.datamodel, { depth: null })
    if (this._getRelationSelection(this.query.query.selection)) {
      const relationToSelect = Object.keys(this._getRelationSelection(this.query.query.selection))[0] // two
      console.log({ relationToSelect })

      // simplified top level query
      const thisLevelSimplifiedQuery = Object.assign({}, this.query)
      thisLevelSimplifiedQuery.query.selection = { $composites: true, $scalars: true } // TODO dynamically remove the relation selection instead of overwriting
      // {
      //   modelName: 'One',
      //   action: 'findMany',
      //   query: {
      //     arguments: { where: { id: 1 } },
      //     selection: {
      //       '$composites': true,
      //       '$scalars': true,
      //     }
      //   }
      // }
      const query = new Query(thisLevelSimplifiedQuery, this.datamodel, this.client, this.libraryEngine)
      query.validate()
      const result = await query.process()
      console.log('Simplified query result', result)

      const targetModelFieldDefinition = this._getModelFieldDefinitionByFieldName(this.modelFields, relationToSelect)
      const relationFromField = targetModelFieldDefinition.relationFromFields[0] // twoId
      console.log({ relationFromField })

      const fks = result.map((item) => item[relationFromField])

      // extracted subquery
      const relationModelToSelect = this._getModelFieldDefinitionByFieldName(this.modelFields, relationToSelect).type
      const otherQuery = {
        modelName: relationModelToSelect,
        action: 'findMany',
        query: {
          arguments: { where: { id: { in: fks } } },
          selection: {
            $composites: true,
            $scalars: true,
            // TODO extracted subquery might also need to include more relation selections, dynamically
            // three: {
            //   arguments: {},
            //   selection: { '$composites': true, '$scalars': true, four: true }
            // }
          },
        },
      }
      const query2 = new Query(otherQuery, this.datamodel, this.client, this.libraryEngine)
      query2.validate()
      const result2 = await query2.process()
      console.log('Extracted subquery result', result2)

      // combine results
      result[0][relationToSelect] = result2[0]
      return [result]
    } else {
      // No relation selection = no `includes`
      const sql = this.buildSql()
      const queryResult = await this.runSql(sql)
      const transformedResult = this.transformResult(queryResult)
      return transformedResult
    }
  }

  /* Craft the SQL */
  buildSql() {
    let sql = ''
    // TODO This has to be additive, instead of if-else
    if (this.query.query.selection._count) {
      sql = this._handleCountAggregations(sql)
      // } else if (this._getRelationSelection(this.query.query.selection)) {
      //   sql = this._handleRelationSelection(sql)
    } else if (this.query.query.arguments.where) {
      sql = this._handleWhere(sql)
    } else if (this.query.query.arguments.cursor) {
      sql = this._handleCursor(sql)
    } else {
      sql = `SELECT * FROM "${this.tableName}"`
    }
    return sql
  }

  async runSql(sql) {
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
    return combinedResult
  }

  transformResult(queryResult) {
    // RESULT VALUE TYPE INDICATION
    // turn returned data into expected format (with type indications for casting in /packages/client/src/runtime/core/jsonProtocol/deserializeJsonResponse.ts)
    // TODO Long term most of this should not be necessary at all, as it is just from a to b and then back to a
    let transformedData = queryResult.map((resultRow) => {
      // iterate over all fields of the row
      for (const resultFieldName in resultRow) {
        if (Object.prototype.hasOwnProperty.call(resultRow, resultFieldName)) {
          // console.dir(`${resultFieldName}: ${resultRow[resultFieldName]}`);
          const modelFieldDefinition = this._getModelFieldDefinitionByFieldName(this.modelFields, resultFieldName)
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
          // TODO others
        }
      }
      return resultRow
    })

    // @map FIELD RENAMING
    // console.log({ modelFields })
    transformedData = transformedData.map((resultRow) => {
      for (const resultFieldName in resultRow) {
        if (Object.prototype.hasOwnProperty.call(resultRow, resultFieldName)) {
          // console.dir(`${key}: ${row[key]}`);
          const modelFieldDefinition = this._getModelFieldDefinitionByFieldDbName(this.modelFields, resultFieldName)
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
    if (this.query.query.arguments.distinct) {
      const distinctKey = this.query.query.arguments.distinct
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
    return transformedData
  }

  _getModelFieldDefinitionByFieldX = (x, modelFields, resultFieldX) => {
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
  _getModelFieldDefinitionByFieldName = (modelFields, resultFieldName) => {
    return this._getModelFieldDefinitionByFieldX('name', modelFields, resultFieldName)
  }
  _getModelFieldDefinitionByFieldRelationName = (modelFields, resultFieldRelationName) => {
    return this._getModelFieldDefinitionByFieldX('relationName', modelFields, resultFieldRelationName)
  }
  _getModelFieldDefinitionByFieldDbName = (modelFields, resultFieldDbName) => {
    return this._getModelFieldDefinitionByFieldX('dbName', modelFields, resultFieldDbName)
  }
  _getModelFieldDefinitionByFieldIsId = (modelFields) => {
    return this._getModelFieldDefinitionByFieldX('isId', modelFields, true)
  }
  _getTypeByFieldName = (modelDefinition, fieldName) => {
    // TODO make this make sense
    return { modelDefinition, fieldName }
  }
  _getModelDefinition = (modelName) => {
    return this.datamodel.models[modelName!]
  }
  _createError = (internalError, isPanic, errorMessage, metaJson, errorCode) => {
    const error = {
      errors: [
        {
          error: internalError,
          user_facing_error: {
            is_panic: isPanic,
            message: errorMessage,
            meta: metaJson,
            error_code: errorCode,
          },
        },
      ],
    }
    return error
  }
  _getRelationSelection = (selection) => {
    // remove _count selection
    if (selection._count) delete selection._count

    // remove default selection
    if (selection['$composites']) delete selection['$composites']
    if (selection['$scalars']) delete selection['$scalars']

    // remove remaining selection fields that are not for relations
    for (const remainingSelectionField in selection) {
      const fieldDefinition = this._getModelFieldDefinitionByFieldName(this.modelFields, remainingSelectionField)
      if (!fieldDefinition.relationName) {
        delete selection[remainingSelectionField]
      }
    }

    // if anything is left, we have some relation selections!
    if (Object.keys(selection).length > 0) {
      return selection
    } else {
      return false
    }
  }

  // private _handleRelationSelection(sql: string) {
  //   console.log('RELATIONSELECTION!')
  //   const relationSelections = this._getRelationSelection(this.query.query.selection)
  //   for (const relationSelection in relationSelections) {
  //     if (Object.prototype.hasOwnProperty.call(relationSelections, relationSelection)) {
  //       /*
  //         query: {
  //           modelName: 'UserOneToOne',
  //           action: 'findMany',
  //           query: {
  //             arguments: { orderBy: { id: 'asc' } },
  //             selection: { '$composites': true, '$scalars': true, profile: true }
  //           }
  //         }

  //         SELECT "public"."UserOneToOne"."id" FROM "public"."UserOneToOne" WHERE 1=1 ORDER BY "public"."UserOneToOne"."id" ASC OFFSET $1
  //         SELECT "public"."ProfileOneToOne"."id", "public"."ProfileOneToOne"."userId" FROM "public"."ProfileOneToOne" WHERE "public"."ProfileOneToOne"."userId" IN ($1,$2) OFFSET $3
  //       */
  //       // const firstSql = this.craftSql(query, modelFields, tableName)
  //     }
  //   }
  //   // handle other selections for relations
  //   sql = `SELECT "public"."UserOneToOne"."id" FROM "public"."UserOneToOne" WHERE 1=1 ORDER BY "public"."UserOneToOne"."id" ASC OFFSET 0`
  //   return sql
  // }

  private _handleCursor(sql: string) {
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
    const cursorField = Object.keys(this.query.query.arguments.cursor)[0]
    const columns = Object.keys(this.query.query.arguments.cursor)
      .map((field) => `"${this.tableName}"."${field}"`)
      .join(', ')
    const values = Object.values(this.query.query.arguments.cursor)
      .map((value) => `'${value}'`)
      .join(', ')
    const whereString = `WHERE "${this.tableName}"."${cursorField}" >= 
                              (SELECT "${this.tableName}"."${cursorField}" FROM "${this.tableName}" WHERE (${columns}) = (${values})) 
                              ORDER BY "${this.tableName}"."${cursorField}" ASC`
    sql = `SELECT * 
                FROM "${this.tableName}"
                ${whereString}
              `
    return sql
  }

  private _handleWhere(sql: string) {
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
    const whereFields = this.query.query.arguments.where
    let whereString = ''
    for (const whereField in whereFields) {
      if (Object.prototype.hasOwnProperty.call(whereFields, whereField)) {
        // TODO Actually handle multple fields in where instead of overwriting the `whereString` in the loop
        const whereFilter = whereFields[whereField]
        if (typeof whereFilter === 'string' || typeof whereFilter === 'number') {
          whereString = `WHERE "${this.tableName}"."${whereField}" = '${whereFilter}'`
          // TODO Below Consider only for Json fields
        } else if ('in' in whereFilter) {
          console.log({ whereFilter })
          whereString = `WHERE "${this.tableName}"."${whereField}" IN ('${whereFilter.in.join("','")}')`
        } else if ('path' in whereFilter && 'equals' in whereFilter) {
          // path + equals
          whereString = `WHERE ("${this.tableName}"."${whereField}"#>ARRAY['${whereFilter.path.join(
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
            whereString = `WHERE "${this.tableName}"."${whereField}" = "${referenceModel}"."${referenceField}"`
          } else {
            // normal value (not a field-reference)
            const fieldDefinition = this._getModelFieldDefinitionByFieldName(this.modelFields, whereField)
            // console.log({fieldDefinition})
            if (fieldDefinition.type == 'Json') {
              whereString = `WHERE "${this.tableName}"."${whereField}"::jsonb = '${JSON.stringify(whereFilter.equals)}'`
            } else {
              whereString = `WHERE "${this.tableName}"."${whereField}" = '${whereFilter.equals}'`
            }
          }
        } else if ('not' in whereFilter) {
          // not only
          whereString = `WHERE "${this.tableName}"."${whereField}"::jsonb <> '${JSON.stringify(whereFilter.not)}'`
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
          whereString = `WHERE "${this.tableName}"."${whereField}"::text LIKE ("${referenceModel}"."${referenceField}" || '%')`
        }
        // TODO handle other cases (only path etc)
      }
    }

    sql = `SELECT * 
                FROM "${this.tableName}"
                ${whereString}
              `
    return sql
  }

  _handleCountAggregations(sql) {
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

    const countSelections = Object.keys((this.query.query.selection._count as JsonFieldSelection).selection)

    // arrays to store generated data to add to the SQL statement
    const _additionalSelections: String[] = []
    const _additionalJoins: String[] = []

    // loop over all selections
    // const relationToCount = selections[0] // 'links`
    for (let i = 0; i < countSelections.length; i++) {
      const relationToCount = countSelections[i]
      // get information from current model
      const relationToCountFieldDefinition = this._getModelFieldDefinitionByFieldName(this.modelFields, relationToCount) // links object

      // console.log({relationToCountFieldDefinition})
      // PART 1: additional selection string
      const relationToCountModelname = relationToCountFieldDefinition.type // 'Link'
      const relationToCountTablename = relationToCountModelname // TODO Actually get the table name for target model, not just the type of the relation
      const _selectionString = `COALESCE("aggr_selection_${i}_${relationToCountTablename}"."_aggr_count_${relationToCount}", 0) AS "_aggr_count_${relationToCount}"`
      _additionalSelections.push(_selectionString)

      // PART 2: additional JOIN
      // get information from model the relation points to
      const relationToCountModelFields = this.datamodel.models[relationToCountModelname!].fields
      // console.dir({ relationToCountModelname, relationToCountModelFields }, { depth: null })
      const targetModelFieldDefinition = this._getModelFieldDefinitionByFieldRelationName(
        relationToCountModelFields,
        relationToCountFieldDefinition.relationName,
      )
      const aggregationTargetType = targetModelFieldDefinition.type // 'User'
      const relationFromField = targetModelFieldDefinition.relationFromFields[0] // this only has content for 1-n, not m-n

      // console.log({ relationFromField })
      // primary key from first table for sql
      const aggregationTargetTypeIdField = this._getModelFieldDefinitionByFieldIsId(this.modelFields)
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
        const relationToCountTypeIdField = this._getModelFieldDefinitionByFieldIsId(relationToCountModelFields) // User details
        console.log({ relationToCountTypeIdField })
        const relationToCountTypeIdFieldName = relationToCountTypeIdField.name // User.uid
        console.log({ relationToCountTypeIdFieldName })

        // Correctly select A and B to match model/table names of relation
        const char1 = relationToCountTablename.charAt(0)
        const char2 = this.tableName.charAt(0)
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

    sql = `SELECT "${this.tableName}".*, 
                ${_additionalSelections.join(',\n')}
              FROM "${this.tableName}"
                ${_additionalJoins.join('\n')}
              WHERE 1=1
                OFFSET 0`
    return sql
  }
}
