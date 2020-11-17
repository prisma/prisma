import { DMMF } from '@prisma/generator-helper'

const dmmf: DMMF.Document = {
  "datamodel": {
    "enums": [],
    "models": [
      {
        "name": "Post",
        "isEmbedded": false,
        "dbName": null,
        "fields": [
          {
            "name": "id",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": true,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": true,
            "default": {
              "name": "autoincrement",
              "args": []
            },
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "author",
            "kind": "object",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "User",
            "hasDefaultValue": false,
            "relationName": "PostToUser",
            "relationFromFields": [
              "authorId"
            ],
            "relationToFields": [
              "id"
            ],
            "relationOnDelete": "NONE",
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "authorId",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": true,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "title",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "String",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "published",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
            "hasDefaultValue": true,
            "default": false,
            "isGenerated": false,
            "isUpdatedAt": false
          }
        ],
        "isGenerated": false,
        "idFields": [],
        "uniqueFields": [],
        "uniqueIndexes": []
      },
      {
        "name": "User",
        "isEmbedded": false,
        "dbName": null,
        "fields": [
          {
            "name": "id",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": true,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": true,
            "default": {
              "name": "autoincrement",
              "args": []
            },
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "email",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": true,
            "isId": false,
            "isReadOnly": false,
            "type": "String",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "posts",
            "kind": "object",
            "isList": true,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Post",
            "hasDefaultValue": false,
            "relationName": "PostToUser",
            "relationFromFields": [],
            "relationToFields": [],
            "relationOnDelete": "NONE",
            "isGenerated": false,
            "isUpdatedAt": false
          }
        ],
        "isGenerated": false,
        "idFields": [],
        "uniqueFields": [],
        "uniqueIndexes": []
      }
    ]
  },
  "schema": {
    "inputObjectTypes": {
      "prisma": [
        {
          "name": "PostWhereInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "AND",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "OR",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "NOT",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "id",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "IntFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "author",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserRelationFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "UserWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "authorId",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "IntFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "title",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "StringFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "published",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "BoolFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "Boolean",
                  "location": "scalar",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "PostOrderByInput",
          "constraints": {
            "maxNumFields": 1,
            "minNumFields": 0
          },
          "fields": [
            {
              "name": "id",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "SortOrder",
                  "namespace": "prisma",
                  "location": "enumTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "authorId",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "SortOrder",
                  "namespace": "prisma",
                  "location": "enumTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "title",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "SortOrder",
                  "namespace": "prisma",
                  "location": "enumTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "published",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "SortOrder",
                  "namespace": "prisma",
                  "location": "enumTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "PostWhereUniqueInput",
          "constraints": {
            "maxNumFields": 1,
            "minNumFields": 1
          },
          "fields": [
            {
              "name": "id",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "UserWhereInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "AND",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "UserWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "OR",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "UserWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "NOT",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "UserWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "id",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "IntFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "email",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "StringFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "posts",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostListRelationFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "UserOrderByInput",
          "constraints": {
            "maxNumFields": 1,
            "minNumFields": 0
          },
          "fields": [
            {
              "name": "id",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "SortOrder",
                  "namespace": "prisma",
                  "location": "enumTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "email",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "SortOrder",
                  "namespace": "prisma",
                  "location": "enumTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "UserWhereUniqueInput",
          "constraints": {
            "maxNumFields": 1,
            "minNumFields": 1
          },
          "fields": [
            {
              "name": "id",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "email",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "PostCreateInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "title",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "published",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Boolean",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "author",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserCreateOneWithoutPostsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "PostUpdateInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "title",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "StringFieldUpdateOperationsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "published",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Boolean",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "BoolFieldUpdateOperationsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "author",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserUpdateOneRequiredWithoutPostsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "PostUpdateManyMutationInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "title",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "StringFieldUpdateOperationsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "published",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Boolean",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "BoolFieldUpdateOperationsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "UserCreateInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "email",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "posts",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostCreateManyWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "UserUpdateInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "email",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "StringFieldUpdateOperationsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "posts",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostUpdateManyWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "UserUpdateManyMutationInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "email",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "StringFieldUpdateOperationsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "IntFilter",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "equals",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "in",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": true
                }
              ]
            },
            {
              "name": "notIn",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": true
                }
              ]
            },
            {
              "name": "lt",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "lte",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "gt",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "gte",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "not",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "NestedIntFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "UserRelationFilter",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "is",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "isNot",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "StringFilter",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "equals",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "in",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": true
                }
              ]
            },
            {
              "name": "notIn",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": true
                }
              ]
            },
            {
              "name": "lt",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "lte",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "gt",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "gte",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "contains",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "startsWith",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "endsWith",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "mode",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "QueryMode",
                  "namespace": "prisma",
                  "location": "enumTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "not",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "NestedStringFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "BoolFilter",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "equals",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Boolean",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "not",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Boolean",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "NestedBoolFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "PostListRelationFilter",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "every",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "some",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "none",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "UserCreateOneWithoutPostsInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "create",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserCreateWithoutPostsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "connect",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "connectOrCreate",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserCreateOrConnectWithoutpostsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "StringFieldUpdateOperationsInput",
          "constraints": {
            "maxNumFields": 1,
            "minNumFields": 1
          },
          "fields": [
            {
              "name": "set",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "BoolFieldUpdateOperationsInput",
          "constraints": {
            "maxNumFields": 1,
            "minNumFields": 1
          },
          "fields": [
            {
              "name": "set",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Boolean",
                  "location": "scalar",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "UserUpdateOneRequiredWithoutPostsInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "create",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserCreateWithoutPostsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "connect",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "update",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserUpdateWithoutPostsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "upsert",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserUpsertWithoutPostsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "connectOrCreate",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserCreateOrConnectWithoutpostsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "PostCreateManyWithoutAuthorInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "create",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostCreateWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostCreateWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "connect",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "connectOrCreate",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostCreateOrConnectWithoutauthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostCreateOrConnectWithoutauthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            }
          ]
        },
        {
          "name": "PostUpdateManyWithoutAuthorInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "create",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostCreateWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostCreateWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "connect",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "set",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "disconnect",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "delete",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "update",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostUpdateWithWhereUniqueWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostUpdateWithWhereUniqueWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "updateMany",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostUpdateManyWithWhereWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostUpdateManyWithWhereWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "deleteMany",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostScalarWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostScalarWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "upsert",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostUpsertWithWhereUniqueWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostUpsertWithWhereUniqueWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "connectOrCreate",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostCreateOrConnectWithoutauthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostCreateOrConnectWithoutauthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            }
          ]
        },
        {
          "name": "NestedIntFilter",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "equals",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "in",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": true
                }
              ]
            },
            {
              "name": "notIn",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": true
                }
              ]
            },
            {
              "name": "lt",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "lte",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "gt",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "gte",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "not",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "NestedIntFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "NestedStringFilter",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "equals",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "in",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": true
                }
              ]
            },
            {
              "name": "notIn",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": true
                }
              ]
            },
            {
              "name": "lt",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "lte",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "gt",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "gte",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "contains",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "startsWith",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "endsWith",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "not",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "NestedStringFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "NestedBoolFilter",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "equals",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Boolean",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "not",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Boolean",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "NestedBoolFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "UserCreateWithoutPostsInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "email",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "UserCreateOrConnectWithoutpostsInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "where",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "create",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserCreateWithoutPostsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "UserUpdateWithoutPostsInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "email",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "StringFieldUpdateOperationsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "UserUpsertWithoutPostsInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "update",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserUpdateWithoutPostsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "create",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "UserCreateWithoutPostsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "PostCreateWithoutAuthorInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "title",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "published",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Boolean",
                  "location": "scalar",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "PostCreateOrConnectWithoutauthorInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "where",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "create",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostCreateWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "PostUpdateWithWhereUniqueWithoutAuthorInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "where",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "data",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostUpdateWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "PostUpdateManyWithWhereWithoutAuthorInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "where",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostScalarWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "data",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostUpdateManyMutationInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "PostScalarWhereInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "AND",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostScalarWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostScalarWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "OR",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostScalarWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostScalarWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "NOT",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostScalarWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "PostScalarWhereInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": true
                }
              ]
            },
            {
              "name": "id",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "IntFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "authorId",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "IntFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "Int",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "title",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "StringFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                }
              ]
            },
            {
              "name": "published",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "BoolFilter",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                },
                {
                  "type": "Boolean",
                  "location": "scalar",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "PostUpsertWithWhereUniqueWithoutAuthorInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "where",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostWhereUniqueInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "update",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostUpdateWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "create",
              "isRequired": true,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "PostCreateWithoutAuthorInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        },
        {
          "name": "PostUpdateWithoutAuthorInput",
          "constraints": {
            "maxNumFields": null,
            "minNumFields": null
          },
          "fields": [
            {
              "name": "title",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "String",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "StringFieldUpdateOperationsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            },
            {
              "name": "published",
              "isRequired": false,
              "isNullable": false,
              "inputTypes": [
                {
                  "type": "Boolean",
                  "location": "scalar",
                  "isList": false
                },
                {
                  "type": "BoolFieldUpdateOperationsInput",
                  "namespace": "prisma",
                  "location": "inputObjectTypes",
                  "isList": false
                }
              ]
            }
          ]
        }
      ]
    },
    "outputObjectTypes": {
      "model": [
        {
          "name": "Post",
          "fields": [
            {
              "name": "id",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            },
            {
              "name": "author",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "User",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "authorId",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            },
            {
              "name": "title",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "String",
                "location": "scalar",
                "isList": false
              }
            },
            {
              "name": "published",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Boolean",
                "location": "scalar",
                "isList": false
              }
            }
          ]
        },
        {
          "name": "User",
          "fields": [
            {
              "name": "id",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            },
            {
              "name": "email",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "String",
                "location": "scalar",
                "isList": false
              }
            },
            {
              "name": "posts",
              "args": [
                {
                  "name": "where",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostWhereInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "orderBy",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostOrderByInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": true
                    },
                    {
                      "type": "PostOrderByInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "cursor",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "take",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Int",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "skip",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Int",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "distinct",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostDistinctFieldEnum",
                      "namespace": "prisma",
                      "location": "enumTypes",
                      "isList": true
                    }
                  ]
                }
              ],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "Post",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": true
              }
            }
          ]
        }
      ],
      "prisma": [
        {
          "name": "Query",
          "fields": [
            {
              "name": "findFirstPost",
              "args": [
                {
                  "name": "where",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostWhereInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "orderBy",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostOrderByInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": true
                    },
                    {
                      "type": "PostOrderByInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "cursor",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "take",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Int",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "skip",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Int",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "distinct",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostDistinctFieldEnum",
                      "namespace": "prisma",
                      "location": "enumTypes",
                      "isList": true
                    }
                  ]
                }
              ],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "Post",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "findManyPost",
              "args": [
                {
                  "name": "where",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostWhereInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "orderBy",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostOrderByInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": true
                    },
                    {
                      "type": "PostOrderByInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "cursor",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "take",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Int",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "skip",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Int",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "distinct",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostDistinctFieldEnum",
                      "namespace": "prisma",
                      "location": "enumTypes",
                      "isList": true
                    }
                  ]
                }
              ],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Post",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": true
              }
            },
            {
              "name": "aggregatePost",
              "args": [
                {
                  "name": "where",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostWhereInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "orderBy",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostOrderByInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": true
                    },
                    {
                      "type": "PostOrderByInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "cursor",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "take",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Int",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "skip",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Int",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "distinct",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostDistinctFieldEnum",
                      "namespace": "prisma",
                      "location": "enumTypes",
                      "isList": true
                    }
                  ]
                }
              ],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "AggregatePost",
                "namespace": "prisma",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "findOnePost",
              "args": [
                {
                  "name": "where",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "Post",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "findFirstUser",
              "args": [
                {
                  "name": "where",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserWhereInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "orderBy",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserOrderByInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": true
                    },
                    {
                      "type": "UserOrderByInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "cursor",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "take",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Int",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "skip",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Int",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "distinct",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserDistinctFieldEnum",
                      "namespace": "prisma",
                      "location": "enumTypes",
                      "isList": true
                    }
                  ]
                }
              ],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "User",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "findManyUser",
              "args": [
                {
                  "name": "where",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserWhereInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "orderBy",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserOrderByInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": true
                    },
                    {
                      "type": "UserOrderByInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "cursor",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "take",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Int",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "skip",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Int",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "distinct",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserDistinctFieldEnum",
                      "namespace": "prisma",
                      "location": "enumTypes",
                      "isList": true
                    }
                  ]
                }
              ],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "User",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": true
              }
            },
            {
              "name": "aggregateUser",
              "args": [
                {
                  "name": "where",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserWhereInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "orderBy",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserOrderByInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": true
                    },
                    {
                      "type": "UserOrderByInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "cursor",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "take",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Int",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "skip",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Int",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "distinct",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserDistinctFieldEnum",
                      "namespace": "prisma",
                      "location": "enumTypes",
                      "isList": true
                    }
                  ]
                }
              ],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "AggregateUser",
                "namespace": "prisma",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "findOneUser",
              "args": [
                {
                  "name": "where",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "User",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": false
              }
            }
          ]
        },
        {
          "name": "Mutation",
          "fields": [
            {
              "name": "createOnePost",
              "args": [
                {
                  "name": "data",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostCreateInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Post",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "deleteOnePost",
              "args": [
                {
                  "name": "where",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "Post",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "updateOnePost",
              "args": [
                {
                  "name": "data",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostUpdateInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "where",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "Post",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "upsertOnePost",
              "args": [
                {
                  "name": "where",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "create",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostCreateInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "update",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostUpdateInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Post",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "updateManyPost",
              "args": [
                {
                  "name": "data",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostUpdateManyMutationInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "where",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostWhereInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "BatchPayload",
                "namespace": "prisma",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "deleteManyPost",
              "args": [
                {
                  "name": "where",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "PostWhereInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "BatchPayload",
                "namespace": "prisma",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "createOneUser",
              "args": [
                {
                  "name": "data",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserCreateInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "User",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "deleteOneUser",
              "args": [
                {
                  "name": "where",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "User",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "updateOneUser",
              "args": [
                {
                  "name": "data",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserUpdateInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "where",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "User",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "upsertOneUser",
              "args": [
                {
                  "name": "where",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserWhereUniqueInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "create",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserCreateInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "update",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserUpdateInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "User",
                "namespace": "model",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "updateManyUser",
              "args": [
                {
                  "name": "data",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserUpdateManyMutationInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "where",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserWhereInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "BatchPayload",
                "namespace": "prisma",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "deleteManyUser",
              "args": [
                {
                  "name": "where",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "UserWhereInput",
                      "namespace": "prisma",
                      "location": "inputObjectTypes",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "BatchPayload",
                "namespace": "prisma",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "executeRaw",
              "args": [
                {
                  "name": "query",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "String",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "parameters",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Json",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Json",
                "location": "scalar",
                "isList": false
              }
            },
            {
              "name": "queryRaw",
              "args": [
                {
                  "name": "query",
                  "isRequired": true,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "String",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                },
                {
                  "name": "parameters",
                  "isRequired": false,
                  "isNullable": false,
                  "inputTypes": [
                    {
                      "type": "Json",
                      "location": "scalar",
                      "isList": false
                    }
                  ]
                }
              ],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Json",
                "location": "scalar",
                "isList": false
              }
            }
          ]
        },
        {
          "name": "AggregatePost",
          "fields": [
            {
              "name": "count",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            },
            {
              "name": "avg",
              "args": [],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "PostAvgAggregateOutputType",
                "namespace": "prisma",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "sum",
              "args": [],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "PostSumAggregateOutputType",
                "namespace": "prisma",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "min",
              "args": [],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "PostMinAggregateOutputType",
                "namespace": "prisma",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "max",
              "args": [],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "PostMaxAggregateOutputType",
                "namespace": "prisma",
                "location": "outputObjectTypes",
                "isList": false
              }
            }
          ]
        },
        {
          "name": "AggregateUser",
          "fields": [
            {
              "name": "count",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            },
            {
              "name": "avg",
              "args": [],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "UserAvgAggregateOutputType",
                "namespace": "prisma",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "sum",
              "args": [],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "UserSumAggregateOutputType",
                "namespace": "prisma",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "min",
              "args": [],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "UserMinAggregateOutputType",
                "namespace": "prisma",
                "location": "outputObjectTypes",
                "isList": false
              }
            },
            {
              "name": "max",
              "args": [],
              "isRequired": false,
              "isNullable": true,
              "outputType": {
                "type": "UserMaxAggregateOutputType",
                "namespace": "prisma",
                "location": "outputObjectTypes",
                "isList": false
              }
            }
          ]
        },
        {
          "name": "BatchPayload",
          "fields": [
            {
              "name": "count",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            }
          ]
        },
        {
          "name": "PostAvgAggregateOutputType",
          "fields": [
            {
              "name": "id",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Float",
                "location": "scalar",
                "isList": false
              }
            },
            {
              "name": "authorId",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Float",
                "location": "scalar",
                "isList": false
              }
            }
          ]
        },
        {
          "name": "PostSumAggregateOutputType",
          "fields": [
            {
              "name": "id",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            },
            {
              "name": "authorId",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            }
          ]
        },
        {
          "name": "PostMinAggregateOutputType",
          "fields": [
            {
              "name": "id",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            },
            {
              "name": "authorId",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            }
          ]
        },
        {
          "name": "PostMaxAggregateOutputType",
          "fields": [
            {
              "name": "id",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            },
            {
              "name": "authorId",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            }
          ]
        },
        {
          "name": "UserAvgAggregateOutputType",
          "fields": [
            {
              "name": "id",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Float",
                "location": "scalar",
                "isList": false
              }
            }
          ]
        },
        {
          "name": "UserSumAggregateOutputType",
          "fields": [
            {
              "name": "id",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            }
          ]
        },
        {
          "name": "UserMinAggregateOutputType",
          "fields": [
            {
              "name": "id",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            }
          ]
        },
        {
          "name": "UserMaxAggregateOutputType",
          "fields": [
            {
              "name": "id",
              "args": [],
              "isRequired": true,
              "isNullable": false,
              "outputType": {
                "type": "Int",
                "location": "scalar",
                "isList": false
              }
            }
          ]
        }
      ]
    },
    "enumTypes": {
      "prisma": [
        {
          "name": "PostDistinctFieldEnum",
          "values": [
            "id",
            "authorId",
            "title",
            "published"
          ]
        },
        {
          "name": "UserDistinctFieldEnum",
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
    }
  },
  "mappings": {
    "modelOperations": [
      {
        "model": "Post",
        "plural": "posts",
        "findUnique": "findOnePost",
        "findFirst": "findFirstPost",
        "findMany": "findManyPost",
        "create": "createOnePost",
        "delete": "deleteOnePost",
        "update": "updateOnePost",
        "deleteMany": "deleteManyPost",
        "updateMany": "updateManyPost",
        "upsert": "upsertOnePost",
        "aggregate": "aggregatePost"
      },
      {
        "model": "User",
        "plural": "users",
        "findUnique": "findOneUser",
        "findFirst": "findFirstUser",
        "findMany": "findManyUser",
        "create": "createOneUser",
        "delete": "deleteOneUser",
        "update": "updateOneUser",
        "deleteMany": "deleteManyUser",
        "updateMany": "updateManyUser",
        "upsert": "upsertOneUser",
        "aggregate": "aggregateUser"
      }
    ],
    "otherOperations": {
      "read": [],
      "write": [
        "executeRaw",
        "queryRaw"
      ]
    }
  }
}
