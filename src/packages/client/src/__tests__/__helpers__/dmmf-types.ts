import { DMMF } from '@prisma/generator-helper'

const dmmf: DMMF.Document = {
  "datamodel": {
    "enums": [],
    "models": [
      {
        "dbName": null,
        "fields": [
          {
            "default": {
              "args": [],
              "name": "autoincrement"
            },
            "hasDefaultValue": true,
            "isGenerated": false,
            "isId": true,
            "isList": false,
            "isReadOnly": false,
            "isRequired": true,
            "isUnique": false,
            "isUpdatedAt": false,
            "kind": "scalar",
            "name": "id",
            "type": "Int"
          },
          {
            "hasDefaultValue": false,
            "isGenerated": false,
            "isId": false,
            "isList": false,
            "isReadOnly": false,
            "isRequired": true,
            "isUnique": false,
            "isUpdatedAt": false,
            "kind": "object",
            "name": "author",
            "relationFromFields": [
              "authorId"
            ],
            "relationName": "PostToUser",
            "relationOnDelete": "NONE",
            "relationToFields": [
              "id"
            ],
            "type": "User"
          },
          {
            "hasDefaultValue": false,
            "isGenerated": false,
            "isId": false,
            "isList": false,
            "isReadOnly": true,
            "isRequired": true,
            "isUnique": false,
            "isUpdatedAt": false,
            "kind": "scalar",
            "name": "authorId",
            "type": "Int"
          },
          {
            "hasDefaultValue": false,
            "isGenerated": false,
            "isId": false,
            "isList": false,
            "isReadOnly": false,
            "isRequired": true,
            "isUnique": false,
            "isUpdatedAt": false,
            "kind": "scalar",
            "name": "title",
            "type": "String"
          },
          {
            "default": false,
            "hasDefaultValue": true,
            "isGenerated": false,
            "isId": false,
            "isList": false,
            "isReadOnly": false,
            "isRequired": true,
            "isUnique": false,
            "isUpdatedAt": false,
            "kind": "scalar",
            "name": "published",
            "type": "Boolean"
          }
        ],
        "idFields": [],
        "isEmbedded": false,
        "isGenerated": false,
        "name": "Post",
        "uniqueFields": [],
        "uniqueIndexes": []
      },
      {
        "dbName": null,
        "fields": [
          {
            "default": {
              "args": [],
              "name": "autoincrement"
            },
            "hasDefaultValue": true,
            "isGenerated": false,
            "isId": true,
            "isList": false,
            "isReadOnly": false,
            "isRequired": true,
            "isUnique": false,
            "isUpdatedAt": false,
            "kind": "scalar",
            "name": "id",
            "type": "Int"
          },
          {
            "hasDefaultValue": false,
            "isGenerated": false,
            "isId": false,
            "isList": false,
            "isReadOnly": false,
            "isRequired": true,
            "isUnique": true,
            "isUpdatedAt": false,
            "kind": "scalar",
            "name": "email",
            "type": "String"
          },
          {
            "hasDefaultValue": false,
            "isGenerated": false,
            "isId": false,
            "isList": true,
            "isReadOnly": false,
            "isRequired": false,
            "isUnique": false,
            "isUpdatedAt": false,
            "kind": "object",
            "name": "posts",
            "relationFromFields": [],
            "relationName": "PostToUser",
            "relationOnDelete": "NONE",
            "relationToFields": [],
            "type": "Post"
          }
        ],
        "idFields": [],
        "isEmbedded": false,
        "isGenerated": false,
        "name": "User",
        "uniqueFields": [],
        "uniqueIndexes": []
      }
    ]
  },
  "mappings": {
    "modelOperations": [
      {
        "aggregate": "aggregatePost",
        "create": "createOnePost",
        "delete": "deleteOnePost",
        "deleteMany": "deleteManyPost",
        "findFirst": "findFirstPost",
        "findMany": "findManyPost",
        "findUnique": "findUniquePost",
        "model": "Post",
        "plural": "posts",
        "update": "updateOnePost",
        "updateMany": "updateManyPost",
        "upsert": "upsertOnePost"
      },
      {
        "aggregate": "aggregateUser",
        "create": "createOneUser",
        "delete": "deleteOneUser",
        "deleteMany": "deleteManyUser",
        "findFirst": "findFirstUser",
        "findMany": "findManyUser",
        "findUnique": "findUniqueUser",
        "model": "User",
        "plural": "users",
        "update": "updateOneUser",
        "updateMany": "updateManyUser",
        "upsert": "upsertOneUser"
      }
    ],
    "otherOperations": {
      "read": [],
      "write": [
        "executeRaw",
        "queryRaw"
      ]
    }
  },
  "schema": {
    "enumTypes": {
      "prisma": [
        {
          "name": "PostScalarFieldEnum",
          "values": [
            "id",
            "authorId",
            "title",
            "published"
          ]
        },
        {
          "name": "UserScalarFieldEnum",
          "values": [
            "id",
            "email"
          ]
        },
        {
          "name": "SortOrder",
          "values": [
            "asc",
            "desc"
          ]
        },
        {
          "name": "QueryMode",
          "values": [
            "default",
            "insensitive"
          ]
        }
      ]
    },
    "inputObjectTypes": {
      "prisma": [
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "AND"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "OR"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "NOT"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "IntFilter"
                },
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "id"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserRelationFilter"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "author"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "IntFilter"
                },
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "authorId"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "StringFilter"
                },
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "title"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "BoolFilter"
                },
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Boolean"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "published"
            }
          ],
          "name": "PostWhereInput"
        },
        {
          "constraints": {
            "maxNumFields": 1,
            "minNumFields": 0
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "enumTypes",
                  "namespace": "prisma",
                  "type": "SortOrder"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "id"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "enumTypes",
                  "namespace": "prisma",
                  "type": "SortOrder"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "authorId"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "enumTypes",
                  "namespace": "prisma",
                  "type": "SortOrder"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "title"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "enumTypes",
                  "namespace": "prisma",
                  "type": "SortOrder"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "published"
            }
          ],
          "name": "PostOrderByInput"
        },
        {
          "constraints": {
            "maxNumFields": 1,
            "minNumFields": 1
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "id"
            }
          ],
          "name": "PostWhereUniqueInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserWhereInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "AND"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserWhereInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "OR"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserWhereInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "NOT"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "IntFilter"
                },
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "id"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "StringFilter"
                },
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "email"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostListRelationFilter"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "posts"
            }
          ],
          "name": "UserWhereInput"
        },
        {
          "constraints": {
            "maxNumFields": 1,
            "minNumFields": 0
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "enumTypes",
                  "namespace": "prisma",
                  "type": "SortOrder"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "id"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "enumTypes",
                  "namespace": "prisma",
                  "type": "SortOrder"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "email"
            }
          ],
          "name": "UserOrderByInput"
        },
        {
          "constraints": {
            "maxNumFields": 1,
            "minNumFields": 1
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "id"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "email"
            }
          ],
          "name": "UserWhereUniqueInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "title"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Boolean"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "published"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserCreateOneWithoutPostsInput"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "author"
            }
          ],
          "name": "PostCreateInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "StringFieldUpdateOperationsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "title"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Boolean"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "BoolFieldUpdateOperationsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "published"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserUpdateOneRequiredWithoutPostsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "author"
            }
          ],
          "name": "PostUpdateInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "StringFieldUpdateOperationsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "title"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Boolean"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "BoolFieldUpdateOperationsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "published"
            }
          ],
          "name": "PostUpdateManyMutationInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "email"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostCreateManyWithoutAuthorInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "posts"
            }
          ],
          "name": "UserCreateInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "StringFieldUpdateOperationsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "email"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostUpdateManyWithoutAuthorInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "posts"
            }
          ],
          "name": "UserUpdateInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "StringFieldUpdateOperationsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "email"
            }
          ],
          "name": "UserUpdateManyMutationInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "equals"
            },
            {
              "inputTypes": [
                {
                  "isList": true,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "in"
            },
            {
              "inputTypes": [
                {
                  "isList": true,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "notIn"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "lt"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "lte"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "gt"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "gte"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "NestedIntFilter"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "not"
            }
          ],
          "name": "IntFilter"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "is"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "isNot"
            }
          ],
          "name": "UserRelationFilter"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "equals"
            },
            {
              "inputTypes": [
                {
                  "isList": true,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "in"
            },
            {
              "inputTypes": [
                {
                  "isList": true,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "notIn"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "lt"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "lte"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "gt"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "gte"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "contains"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "startsWith"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "endsWith"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "enumTypes",
                  "namespace": "prisma",
                  "type": "QueryMode"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "mode"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "NestedStringFilter"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "not"
            }
          ],
          "name": "StringFilter"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Boolean"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "equals"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Boolean"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "NestedBoolFilter"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "not"
            }
          ],
          "name": "BoolFilter"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "every"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "some"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "none"
            }
          ],
          "name": "PostListRelationFilter"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserCreateWithoutPostsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "create"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserWhereUniqueInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "connect"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserCreateOrConnectWithoutpostsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "connectOrCreate"
            }
          ],
          "name": "UserCreateOneWithoutPostsInput"
        },
        {
          "constraints": {
            "maxNumFields": 1,
            "minNumFields": 1
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "set"
            }
          ],
          "name": "StringFieldUpdateOperationsInput"
        },
        {
          "constraints": {
            "maxNumFields": 1,
            "minNumFields": 1
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Boolean"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "set"
            }
          ],
          "name": "BoolFieldUpdateOperationsInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserCreateWithoutPostsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "create"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserWhereUniqueInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "connect"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserUpdateWithoutPostsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "update"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserUpsertWithoutPostsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "upsert"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserCreateOrConnectWithoutpostsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "connectOrCreate"
            }
          ],
          "name": "UserUpdateOneRequiredWithoutPostsInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostCreateWithoutAuthorInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostCreateWithoutAuthorInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "create"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereUniqueInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereUniqueInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "connect"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostCreateOrConnectWithoutauthorInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostCreateOrConnectWithoutauthorInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "connectOrCreate"
            }
          ],
          "name": "PostCreateManyWithoutAuthorInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostCreateWithoutAuthorInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostCreateWithoutAuthorInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "create"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereUniqueInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereUniqueInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "connect"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereUniqueInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereUniqueInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "set"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereUniqueInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereUniqueInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "disconnect"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereUniqueInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereUniqueInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "delete"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostUpdateWithWhereUniqueWithoutAuthorInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostUpdateWithWhereUniqueWithoutAuthorInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "update"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostUpdateManyWithWhereWithoutAuthorInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostUpdateManyWithWhereWithoutAuthorInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "updateMany"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostScalarWhereInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostScalarWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "deleteMany"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostUpsertWithWhereUniqueWithoutAuthorInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostUpsertWithWhereUniqueWithoutAuthorInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "upsert"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostCreateOrConnectWithoutauthorInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostCreateOrConnectWithoutauthorInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "connectOrCreate"
            }
          ],
          "name": "PostUpdateManyWithoutAuthorInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "equals"
            },
            {
              "inputTypes": [
                {
                  "isList": true,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "in"
            },
            {
              "inputTypes": [
                {
                  "isList": true,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "notIn"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "lt"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "lte"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "gt"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "gte"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "NestedIntFilter"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "not"
            }
          ],
          "name": "NestedIntFilter"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "equals"
            },
            {
              "inputTypes": [
                {
                  "isList": true,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "in"
            },
            {
              "inputTypes": [
                {
                  "isList": true,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "notIn"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "lt"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "lte"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "gt"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "gte"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "contains"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "startsWith"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "endsWith"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "NestedStringFilter"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "not"
            }
          ],
          "name": "NestedStringFilter"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Boolean"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "equals"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Boolean"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "NestedBoolFilter"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "not"
            }
          ],
          "name": "NestedBoolFilter"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "email"
            }
          ],
          "name": "UserCreateWithoutPostsInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserWhereUniqueInput"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "where"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserCreateWithoutPostsInput"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "create"
            }
          ],
          "name": "UserCreateOrConnectWithoutpostsInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "StringFieldUpdateOperationsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "email"
            }
          ],
          "name": "UserUpdateWithoutPostsInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserUpdateWithoutPostsInput"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "update"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "UserCreateWithoutPostsInput"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "create"
            }
          ],
          "name": "UserUpsertWithoutPostsInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "title"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Boolean"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "published"
            }
          ],
          "name": "PostCreateWithoutAuthorInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereUniqueInput"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "where"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostCreateWithoutAuthorInput"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "create"
            }
          ],
          "name": "PostCreateOrConnectWithoutauthorInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereUniqueInput"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "where"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostUpdateWithoutAuthorInput"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "data"
            }
          ],
          "name": "PostUpdateWithWhereUniqueWithoutAuthorInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostScalarWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "where"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostUpdateManyMutationInput"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "data"
            }
          ],
          "name": "PostUpdateManyWithWhereWithoutAuthorInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostScalarWhereInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostScalarWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "AND"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostScalarWhereInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostScalarWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "OR"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostScalarWhereInput"
                },
                {
                  "isList": true,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostScalarWhereInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "NOT"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "IntFilter"
                },
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "id"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "IntFilter"
                },
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Int"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "authorId"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "StringFilter"
                },
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "title"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "BoolFilter"
                },
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Boolean"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "published"
            }
          ],
          "name": "PostScalarWhereInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostWhereUniqueInput"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "where"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostUpdateWithoutAuthorInput"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "update"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "PostCreateWithoutAuthorInput"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "create"
            }
          ],
          "name": "PostUpsertWithWhereUniqueWithoutAuthorInput"
        },
        {
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "String"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "StringFieldUpdateOperationsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "title"
            },
            {
              "inputTypes": [
                {
                  "isList": false,
                  "location": "scalar",
                  "type": "Boolean"
                },
                {
                  "isList": false,
                  "location": "inputObjectTypes",
                  "namespace": "prisma",
                  "type": "BoolFieldUpdateOperationsInput"
                }
              ],
              "isNullable": false,
              "isRequired": false,
              "name": "published"
            }
          ],
          "name": "PostUpdateWithoutAuthorInput"
        }
      ]
    },
    "outputObjectTypes": {
      "model": [
        {
          "fields": [
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "id",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "author",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "User"
              }
            },
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "authorId",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "title",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "String"
              }
            },
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "published",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Boolean"
              }
            }
          ],
          "name": "Post"
        },
        {
          "fields": [
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "id",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "email",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "String"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "where"
                },
                {
                  "inputTypes": [
                    {
                      "isList": true,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostOrderByInput"
                    },
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostOrderByInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "orderBy"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "cursor"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Int"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "take"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Int"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "skip"
                },
                {
                  "inputTypes": [
                    {
                      "isList": true,
                      "location": "enumTypes",
                      "namespace": "prisma",
                      "type": "PostScalarFieldEnum"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "distinct"
                }
              ],
              "isNullable": true,
              "isRequired": false,
              "name": "posts",
              "outputType": {
                "isList": true,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "Post"
              }
            }
          ],
          "name": "User"
        }
      ],
      "prisma": [
        {
          "fields": [
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "where"
                },
                {
                  "inputTypes": [
                    {
                      "isList": true,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostOrderByInput"
                    },
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostOrderByInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "orderBy"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "cursor"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Int"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "take"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Int"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "skip"
                },
                {
                  "inputTypes": [
                    {
                      "isList": true,
                      "location": "enumTypes",
                      "namespace": "prisma",
                      "type": "PostScalarFieldEnum"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "distinct"
                }
              ],
              "isNullable": true,
              "isRequired": false,
              "name": "findFirstPost",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "Post"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "where"
                },
                {
                  "inputTypes": [
                    {
                      "isList": true,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostOrderByInput"
                    },
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostOrderByInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "orderBy"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "cursor"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Int"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "take"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Int"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "skip"
                },
                {
                  "inputTypes": [
                    {
                      "isList": true,
                      "location": "enumTypes",
                      "namespace": "prisma",
                      "type": "PostScalarFieldEnum"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "distinct"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "findManyPost",
              "outputType": {
                "isList": true,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "Post"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "where"
                },
                {
                  "inputTypes": [
                    {
                      "isList": true,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostOrderByInput"
                    },
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostOrderByInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "orderBy"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "cursor"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Int"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "take"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Int"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "skip"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "aggregatePost",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "AggregatePost"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "where"
                }
              ],
              "deprecation": {
                "plannedRemovalVersion": "2.15",
                "reason": "The `findOne` query has been deprecated and replaced with `findUnique`.",
                "sinceVersion": "2.14"
              },
              "isNullable": true,
              "isRequired": false,
              "name": "findOnePost",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "Post"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "where"
                }
              ],
              "isNullable": true,
              "isRequired": false,
              "name": "findUniquePost",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "Post"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserWhereInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "where"
                },
                {
                  "inputTypes": [
                    {
                      "isList": true,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserOrderByInput"
                    },
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserOrderByInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "orderBy"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "cursor"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Int"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "take"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Int"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "skip"
                },
                {
                  "inputTypes": [
                    {
                      "isList": true,
                      "location": "enumTypes",
                      "namespace": "prisma",
                      "type": "UserScalarFieldEnum"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "distinct"
                }
              ],
              "isNullable": true,
              "isRequired": false,
              "name": "findFirstUser",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "User"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserWhereInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "where"
                },
                {
                  "inputTypes": [
                    {
                      "isList": true,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserOrderByInput"
                    },
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserOrderByInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "orderBy"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "cursor"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Int"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "take"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Int"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "skip"
                },
                {
                  "inputTypes": [
                    {
                      "isList": true,
                      "location": "enumTypes",
                      "namespace": "prisma",
                      "type": "UserScalarFieldEnum"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "distinct"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "findManyUser",
              "outputType": {
                "isList": true,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "User"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserWhereInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "where"
                },
                {
                  "inputTypes": [
                    {
                      "isList": true,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserOrderByInput"
                    },
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserOrderByInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "orderBy"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "cursor"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Int"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "take"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Int"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "skip"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "aggregateUser",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "AggregateUser"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "where"
                }
              ],
              "deprecation": {
                "plannedRemovalVersion": "2.15",
                "reason": "The `findOne` query has been deprecated and replaced with `findUnique`.",
                "sinceVersion": "2.14"
              },
              "isNullable": true,
              "isRequired": false,
              "name": "findOneUser",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "User"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "where"
                }
              ],
              "isNullable": true,
              "isRequired": false,
              "name": "findUniqueUser",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "User"
              }
            }
          ],
          "name": "Query"
        },
        {
          "fields": [
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostCreateInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "data"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "createOnePost",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "Post"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "where"
                }
              ],
              "isNullable": true,
              "isRequired": false,
              "name": "deleteOnePost",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "Post"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostUpdateInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "data"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "where"
                }
              ],
              "isNullable": true,
              "isRequired": false,
              "name": "updateOnePost",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "Post"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "where"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostCreateInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "create"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostUpdateInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "update"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "upsertOnePost",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "Post"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostUpdateManyMutationInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "data"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "where"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "updateManyPost",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "BatchPayload"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "PostWhereInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "where"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "deleteManyPost",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "BatchPayload"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserCreateInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "data"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "createOneUser",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "User"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "where"
                }
              ],
              "isNullable": true,
              "isRequired": false,
              "name": "deleteOneUser",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "User"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserUpdateInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "data"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "where"
                }
              ],
              "isNullable": true,
              "isRequired": false,
              "name": "updateOneUser",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "User"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserWhereUniqueInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "where"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserCreateInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "create"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserUpdateInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "update"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "upsertOneUser",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "model",
                "type": "User"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserUpdateManyMutationInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "data"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserWhereInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "where"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "updateManyUser",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "BatchPayload"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "inputObjectTypes",
                      "namespace": "prisma",
                      "type": "UserWhereInput"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "where"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "deleteManyUser",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "BatchPayload"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "String"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "query"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Json"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "parameters"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "executeRaw",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Json"
              }
            },
            {
              "args": [
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "String"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": true,
                  "name": "query"
                },
                {
                  "inputTypes": [
                    {
                      "isList": false,
                      "location": "scalar",
                      "type": "Json"
                    }
                  ],
                  "isNullable": false,
                  "isRequired": false,
                  "name": "parameters"
                }
              ],
              "isNullable": false,
              "isRequired": true,
              "name": "queryRaw",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Json"
              }
            }
          ],
          "name": "Mutation"
        },
        {
          "fields": [
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "count",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "PostCountAggregateOutputType"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "avg",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "PostAvgAggregateOutputType"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "sum",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "PostSumAggregateOutputType"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "min",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "PostMinAggregateOutputType"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "max",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "PostMaxAggregateOutputType"
              }
            }
          ],
          "name": "AggregatePost"
        },
        {
          "fields": [
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "count",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "UserCountAggregateOutputType"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "avg",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "UserAvgAggregateOutputType"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "sum",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "UserSumAggregateOutputType"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "min",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "UserMinAggregateOutputType"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "max",
              "outputType": {
                "isList": false,
                "location": "outputObjectTypes",
                "namespace": "prisma",
                "type": "UserMaxAggregateOutputType"
              }
            }
          ],
          "name": "AggregateUser"
        },
        {
          "fields": [
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "count",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            }
          ],
          "name": "BatchPayload"
        },
        {
          "fields": [
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "id",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "authorId",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "title",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "published",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "$all",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            }
          ],
          "name": "PostCountAggregateOutputType"
        },
        {
          "fields": [
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "id",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Float"
              }
            },
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "authorId",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Float"
              }
            }
          ],
          "name": "PostAvgAggregateOutputType"
        },
        {
          "fields": [
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "id",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "authorId",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            }
          ],
          "name": "PostSumAggregateOutputType"
        },
        {
          "fields": [
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "id",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "authorId",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "title",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "String"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "published",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Boolean"
              }
            }
          ],
          "name": "PostMinAggregateOutputType"
        },
        {
          "fields": [
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "id",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "authorId",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "title",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "String"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "published",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Boolean"
              }
            }
          ],
          "name": "PostMaxAggregateOutputType"
        },
        {
          "fields": [
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "id",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "email",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "$all",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            }
          ],
          "name": "UserCountAggregateOutputType"
        },
        {
          "fields": [
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "id",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Float"
              }
            }
          ],
          "name": "UserAvgAggregateOutputType"
        },
        {
          "fields": [
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "id",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            }
          ],
          "name": "UserSumAggregateOutputType"
        },
        {
          "fields": [
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "id",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "email",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "String"
              }
            }
          ],
          "name": "UserMinAggregateOutputType"
        },
        {
          "fields": [
            {
              "args": [],
              "isNullable": false,
              "isRequired": true,
              "name": "id",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "Int"
              }
            },
            {
              "args": [],
              "isNullable": true,
              "isRequired": false,
              "name": "email",
              "outputType": {
                "isList": false,
                "location": "scalar",
                "type": "String"
              }
            }
          ],
          "name": "UserMaxAggregateOutputType"
        }
      ]
    }
  }
}
