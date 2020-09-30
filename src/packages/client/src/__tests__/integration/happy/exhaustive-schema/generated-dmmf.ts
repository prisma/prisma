import { DMMF } from '@prisma/generator-helper'

  const dmmf: DMMF.Document = {
  "datamodel": {
    "enums": [
      {
        "name": "ABeautifulEnum",
        "values": [
          {
            "name": "A",
            "dbName": null
          },
          {
            "name": "B",
            "dbName": null
          },
          {
            "name": "C",
            "dbName": null
          }
        ],
        "dbName": null
      }
    ],
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
            "name": "createdAt",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "DateTime",
            "hasDefaultValue": true,
            "default": {
              "name": "now",
              "args": []
            },
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
            "name": "content",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
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
            "name": "int",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalInt",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "float",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Float",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalFloat",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Float",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "string",
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
            "name": "optionalString",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "String",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "json",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Json",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalJson",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Json",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "enum",
            "kind": "enum",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ABeautifulEnum",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalEnum",
            "kind": "enum",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ABeautifulEnum",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "boolean",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalBoolean",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
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
      },
      {
        "name": "M",
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
            "name": "n",
            "kind": "object",
            "isList": true,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "N",
            "hasDefaultValue": false,
            "relationName": "MToN",
            "relationFromFields": [],
            "relationToFields": [
              "id"
            ],
            "relationOnDelete": "NONE",
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "int",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalInt",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "float",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Float",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalFloat",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Float",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "string",
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
            "name": "optionalString",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "String",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "json",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Json",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalJson",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Json",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "enum",
            "kind": "enum",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ABeautifulEnum",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalEnum",
            "kind": "enum",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ABeautifulEnum",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "boolean",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalBoolean",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
            "hasDefaultValue": false,
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
        "name": "N",
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
            "name": "m",
            "kind": "object",
            "isList": true,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "M",
            "hasDefaultValue": false,
            "relationName": "MToN",
            "relationFromFields": [],
            "relationToFields": [
              "id"
            ],
            "relationOnDelete": "NONE",
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "int",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalInt",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "float",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Float",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalFloat",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Float",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "string",
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
            "name": "optionalString",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "String",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "json",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Json",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalJson",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Json",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "enum",
            "kind": "enum",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ABeautifulEnum",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalEnum",
            "kind": "enum",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ABeautifulEnum",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "boolean",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalBoolean",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
            "hasDefaultValue": false,
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
        "name": "OneOptional",
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
            "name": "many",
            "kind": "object",
            "isList": true,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ManyRequired",
            "hasDefaultValue": false,
            "relationName": "ManyRequiredToOneOptional",
            "relationFromFields": [],
            "relationToFields": [],
            "relationOnDelete": "NONE",
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "int",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalInt",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "float",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Float",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalFloat",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Float",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "string",
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
            "name": "optionalString",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "String",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "json",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Json",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalJson",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Json",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "enum",
            "kind": "enum",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ABeautifulEnum",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalEnum",
            "kind": "enum",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ABeautifulEnum",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "boolean",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalBoolean",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
            "hasDefaultValue": false,
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
        "name": "ManyRequired",
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
            "name": "one",
            "kind": "object",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "OneOptional",
            "hasDefaultValue": false,
            "relationName": "ManyRequiredToOneOptional",
            "relationFromFields": [
              "oneOptionalId"
            ],
            "relationToFields": [
              "id"
            ],
            "relationOnDelete": "NONE",
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "oneOptionalId",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": true,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "int",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalInt",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "float",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Float",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalFloat",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Float",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "string",
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
            "name": "optionalString",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "String",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "json",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Json",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalJson",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Json",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "enum",
            "kind": "enum",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ABeautifulEnum",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalEnum",
            "kind": "enum",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ABeautifulEnum",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "boolean",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalBoolean",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
            "hasDefaultValue": false,
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
        "name": "OptionalSide1",
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
            "name": "opti",
            "kind": "object",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "OptionalSide2",
            "hasDefaultValue": false,
            "relationName": "OptionalSide1ToOptionalSide2",
            "relationFromFields": [
              "optionalSide2Id"
            ],
            "relationToFields": [
              "id"
            ],
            "relationOnDelete": "NONE",
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalSide2Id",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": true,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "int",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalInt",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "float",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Float",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalFloat",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Float",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "string",
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
            "name": "optionalString",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "String",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "json",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Json",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalJson",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Json",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "enum",
            "kind": "enum",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ABeautifulEnum",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalEnum",
            "kind": "enum",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ABeautifulEnum",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "boolean",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalBoolean",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
            "hasDefaultValue": false,
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
        "name": "OptionalSide2",
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
            "name": "opti",
            "kind": "object",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "OptionalSide1",
            "hasDefaultValue": false,
            "relationName": "OptionalSide1ToOptionalSide2",
            "relationFromFields": [],
            "relationToFields": [],
            "relationOnDelete": "NONE",
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "int",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalInt",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Int",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "float",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Float",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalFloat",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Float",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "string",
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
            "name": "optionalString",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "String",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "json",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Json",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalJson",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Json",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "enum",
            "kind": "enum",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ABeautifulEnum",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalEnum",
            "kind": "enum",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "ABeautifulEnum",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "boolean",
            "kind": "scalar",
            "isList": false,
            "isRequired": true,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
            "hasDefaultValue": false,
            "isGenerated": false,
            "isUpdatedAt": false
          },
          {
            "name": "optionalBoolean",
            "kind": "scalar",
            "isList": false,
            "isRequired": false,
            "isUnique": false,
            "isId": false,
            "isReadOnly": false,
            "type": "Boolean",
            "hasDefaultValue": false,
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
    "rootQueryType": "Query",
    "rootMutationType": "Mutation",
    "inputTypes": [
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "createdAt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "DateTimeFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "DateTime",
                "kind": "scalar",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "content",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "StringNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "UserWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
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
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "createdAt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
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
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "content",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
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
                "kind": "enum",
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
                "kind": "enum",
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
                "kind": "scalar",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "UserWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "UserWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "UserWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "IntFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "IntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "FloatFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "FloatNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "StringFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "StringNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonNullableFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "BoolFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "BoolNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "object",
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
                "kind": "enum",
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
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
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
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "MWhereInput",
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
                "type": "MWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MWhereInput",
                "kind": "object",
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
                "type": "MWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MWhereInput",
                "kind": "object",
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
                "type": "MWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "n",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "NListRelationFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "IntFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "IntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "FloatFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "FloatNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "StringFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "StringNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonNullableFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "BoolFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "BoolNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "MOrderByInput",
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
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "MWhereUniqueInput",
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
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NWhereInput",
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
                "type": "NWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NWhereInput",
                "kind": "object",
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
                "type": "NWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NWhereInput",
                "kind": "object",
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
                "type": "NWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "m",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "MListRelationFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "IntFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "IntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "FloatFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "FloatNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "StringFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "StringNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonNullableFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "BoolFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "BoolNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NOrderByInput",
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
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NWhereUniqueInput",
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
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OneOptionalWhereInput",
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
                "type": "OneOptionalWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "OneOptionalWhereInput",
                "kind": "object",
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
                "type": "OneOptionalWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "OneOptionalWhereInput",
                "kind": "object",
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
                "type": "OneOptionalWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "OneOptionalWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "many",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ManyRequiredListRelationFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "IntFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "IntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "FloatFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "FloatNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "StringFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "StringNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonNullableFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "BoolFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "BoolNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OneOptionalOrderByInput",
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
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OneOptionalWhereUniqueInput",
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
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredWhereInput",
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
                "type": "ManyRequiredWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredWhereInput",
                "kind": "object",
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
                "type": "ManyRequiredWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredWhereInput",
                "kind": "object",
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
                "type": "ManyRequiredWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "one",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "OneOptionalRelationFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "OneOptionalWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "oneOptionalId",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "IntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "IntFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "IntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "FloatFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "FloatNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "StringFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "StringNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonNullableFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "BoolFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "BoolNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredOrderByInput",
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
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "oneOptionalId",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredWhereUniqueInput",
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
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide1WhereInput",
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
                "type": "OptionalSide1WhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "OptionalSide1WhereInput",
                "kind": "object",
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
                "type": "OptionalSide1WhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "OptionalSide1WhereInput",
                "kind": "object",
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
                "type": "OptionalSide1WhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "OptionalSide1WhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "opti",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "OptionalSide2RelationFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "OptionalSide2WhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalSide2Id",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "IntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "IntFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "IntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "FloatFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "FloatNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "StringFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "StringNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonNullableFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "BoolFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "BoolNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide1OrderByInput",
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
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalSide2Id",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide1WhereUniqueInput",
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
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide2WhereInput",
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
                "type": "OptionalSide2WhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "OptionalSide2WhereInput",
                "kind": "object",
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
                "type": "OptionalSide2WhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "OptionalSide2WhereInput",
                "kind": "object",
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
                "type": "OptionalSide2WhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "OptionalSide2WhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "opti",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "OptionalSide1RelationFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "OptionalSide1WhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "IntFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "IntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "FloatFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "FloatNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "StringFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "StringNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonNullableFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "BoolFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "BoolNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide2OrderByInput",
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
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "SortOrder",
                "kind": "enum",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide2WhereUniqueInput",
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
                "kind": "scalar",
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
            "name": "createdAt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "DateTime",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "title",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "content",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "object",
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
            "name": "createdAt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "DateTime",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "DateTimeFieldUpdateOperationsInput",
                "kind": "object",
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
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "content",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
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
                "kind": "object",
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
            "name": "createdAt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "DateTime",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "DateTimeFieldUpdateOperationsInput",
                "kind": "object",
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
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "content",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
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
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "object",
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
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "object",
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
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "MCreateInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "n",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "NCreateManyWithoutMInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "MUpdateInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "n",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "NUpdateManyWithoutMInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "MUpdateManyMutationInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NCreateInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "m",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "MCreateManyWithoutNInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NUpdateInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "m",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "MUpdateManyWithoutNInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NUpdateManyMutationInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OneOptionalCreateInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "many",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ManyRequiredCreateManyWithoutOneInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OneOptionalUpdateInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "many",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ManyRequiredUpdateManyWithoutOneInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OneOptionalUpdateManyMutationInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredCreateInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "one",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "OneOptionalCreateOneWithoutManyInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredUpdateInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "one",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "OneOptionalUpdateOneWithoutManyInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredUpdateManyMutationInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide1CreateInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "opti",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "OptionalSide2CreateOneWithoutOptiInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide1UpdateInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "opti",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "OptionalSide2UpdateOneWithoutOptiInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide1UpdateManyMutationInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide2CreateInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "opti",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "OptionalSide1CreateOneWithoutOptiInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide2UpdateInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "opti",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "OptionalSide1UpdateOneWithoutOptiInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide2UpdateManyMutationInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedIntFilter",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "DateTimeFilter",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "type": "DateTime",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedDateTimeFilter",
                "kind": "object",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "enum",
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
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedStringFilter",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "StringNullableFilter",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "equals",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "in",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "notIn",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "not",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedStringNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedBoolFilter",
                "kind": "object",
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
                "kind": "object",
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
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "IntNullableFilter",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "equals",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "in",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "notIn",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "not",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedIntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "FloatFilter",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedFloatFilter",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "FloatNullableFilter",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "equals",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "in",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "notIn",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "lt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "not",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedFloatNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "JsonFilter",
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
                "type": "Json",
                "kind": "scalar",
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
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "JsonNullableFilter",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "equals",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "not",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "EnumABeautifulEnumFilter",
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
                "type": "ABeautifulEnum",
                "kind": "enum",
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
                "type": "ABeautifulEnum",
                "kind": "enum",
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
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": true
              }
            ]
          },
          {
            "name": "not",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NestedEnumABeautifulEnumFilter",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "EnumABeautifulEnumNullableFilter",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "equals",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "in",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "notIn",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "not",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NestedEnumABeautifulEnumNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "BoolNullableFilter",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "equals",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "not",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedBoolNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "object",
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
                "kind": "object",
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
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NListRelationFilter",
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
                "type": "NWhereInput",
                "kind": "object",
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
                "type": "NWhereInput",
                "kind": "object",
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
                "type": "NWhereInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "MListRelationFilter",
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
                "type": "MWhereInput",
                "kind": "object",
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
                "type": "MWhereInput",
                "kind": "object",
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
                "type": "MWhereInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredListRelationFilter",
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
                "type": "ManyRequiredWhereInput",
                "kind": "object",
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
                "type": "ManyRequiredWhereInput",
                "kind": "object",
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
                "type": "ManyRequiredWhereInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OneOptionalRelationFilter",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "is",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "OneOptionalWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "isNot",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "OneOptionalWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide2RelationFilter",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "is",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "OptionalSide2WhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "isNot",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "OptionalSide2WhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide1RelationFilter",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "is",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "OptionalSide1WhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "isNot",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "OptionalSide1WhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "object",
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
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "DateTimeFieldUpdateOperationsInput",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NullableStringFieldUpdateOperationsInput",
        "constraints": {
          "maxNumFields": 1,
          "minNumFields": 1
        },
        "fields": [
          {
            "name": "set",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "object",
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
                "kind": "object",
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
                "type": "UserUpdateWithoutPostsDataInput",
                "kind": "object",
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
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostCreateWithoutAuthorInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostWhereUniqueInput",
                "kind": "object",
                "isList": true
              }
            ]
          }
        ]
      },
      {
        "name": "IntFieldUpdateOperationsInput",
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
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NullableIntFieldUpdateOperationsInput",
        "constraints": {
          "maxNumFields": 1,
          "minNumFields": 1
        },
        "fields": [
          {
            "name": "set",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "FloatFieldUpdateOperationsInput",
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
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NullableFloatFieldUpdateOperationsInput",
        "constraints": {
          "maxNumFields": 1,
          "minNumFields": 1
        },
        "fields": [
          {
            "name": "set",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "EnumABeautifulEnumFieldUpdateOperationsInput",
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
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
        "constraints": {
          "maxNumFields": 1,
          "minNumFields": 1
        },
        "fields": [
          {
            "name": "set",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NullableBoolFieldUpdateOperationsInput",
        "constraints": {
          "maxNumFields": 1,
          "minNumFields": 1
        },
        "fields": [
          {
            "name": "set",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostCreateWithoutAuthorInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostWhereUniqueInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostWhereUniqueInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostWhereUniqueInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostWhereUniqueInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostUpdateWithWhereUniqueWithoutAuthorInput",
                "kind": "object",
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
                "type": "PostUpdateManyWithWhereNestedInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostUpdateManyWithWhereNestedInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostScalarWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostUpsertWithWhereUniqueWithoutAuthorInput",
                "kind": "object",
                "isList": true
              }
            ]
          }
        ]
      },
      {
        "name": "NCreateManyWithoutMInput",
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
                "type": "NCreateWithoutMInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NCreateWithoutMInput",
                "kind": "object",
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
                "type": "NWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NWhereUniqueInput",
                "kind": "object",
                "isList": true
              }
            ]
          }
        ]
      },
      {
        "name": "NUpdateManyWithoutMInput",
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
                "type": "NCreateWithoutMInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NCreateWithoutMInput",
                "kind": "object",
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
                "type": "NWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NWhereUniqueInput",
                "kind": "object",
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
                "type": "NWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NWhereUniqueInput",
                "kind": "object",
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
                "type": "NWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NWhereUniqueInput",
                "kind": "object",
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
                "type": "NWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NWhereUniqueInput",
                "kind": "object",
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
                "type": "NUpdateWithWhereUniqueWithoutMInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NUpdateWithWhereUniqueWithoutMInput",
                "kind": "object",
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
                "type": "NUpdateManyWithWhereNestedInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NUpdateManyWithWhereNestedInput",
                "kind": "object",
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
                "type": "NScalarWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NScalarWhereInput",
                "kind": "object",
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
                "type": "NUpsertWithWhereUniqueWithoutMInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NUpsertWithWhereUniqueWithoutMInput",
                "kind": "object",
                "isList": true
              }
            ]
          }
        ]
      },
      {
        "name": "MCreateManyWithoutNInput",
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
                "type": "MCreateWithoutNInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MCreateWithoutNInput",
                "kind": "object",
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
                "type": "MWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MWhereUniqueInput",
                "kind": "object",
                "isList": true
              }
            ]
          }
        ]
      },
      {
        "name": "MUpdateManyWithoutNInput",
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
                "type": "MCreateWithoutNInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MCreateWithoutNInput",
                "kind": "object",
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
                "type": "MWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MWhereUniqueInput",
                "kind": "object",
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
                "type": "MWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MWhereUniqueInput",
                "kind": "object",
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
                "type": "MWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MWhereUniqueInput",
                "kind": "object",
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
                "type": "MWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MWhereUniqueInput",
                "kind": "object",
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
                "type": "MUpdateWithWhereUniqueWithoutNInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MUpdateWithWhereUniqueWithoutNInput",
                "kind": "object",
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
                "type": "MUpdateManyWithWhereNestedInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MUpdateManyWithWhereNestedInput",
                "kind": "object",
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
                "type": "MScalarWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MScalarWhereInput",
                "kind": "object",
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
                "type": "MUpsertWithWhereUniqueWithoutNInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MUpsertWithWhereUniqueWithoutNInput",
                "kind": "object",
                "isList": true
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredCreateManyWithoutOneInput",
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
                "type": "ManyRequiredCreateWithoutOneInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredCreateWithoutOneInput",
                "kind": "object",
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
                "type": "ManyRequiredWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredWhereUniqueInput",
                "kind": "object",
                "isList": true
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredUpdateManyWithoutOneInput",
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
                "type": "ManyRequiredCreateWithoutOneInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredCreateWithoutOneInput",
                "kind": "object",
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
                "type": "ManyRequiredWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredWhereUniqueInput",
                "kind": "object",
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
                "type": "ManyRequiredWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredWhereUniqueInput",
                "kind": "object",
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
                "type": "ManyRequiredWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredWhereUniqueInput",
                "kind": "object",
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
                "type": "ManyRequiredWhereUniqueInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredWhereUniqueInput",
                "kind": "object",
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
                "type": "ManyRequiredUpdateWithWhereUniqueWithoutOneInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredUpdateWithWhereUniqueWithoutOneInput",
                "kind": "object",
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
                "type": "ManyRequiredUpdateManyWithWhereNestedInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredUpdateManyWithWhereNestedInput",
                "kind": "object",
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
                "type": "ManyRequiredScalarWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredScalarWhereInput",
                "kind": "object",
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
                "type": "ManyRequiredUpsertWithWhereUniqueWithoutOneInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredUpsertWithWhereUniqueWithoutOneInput",
                "kind": "object",
                "isList": true
              }
            ]
          }
        ]
      },
      {
        "name": "OneOptionalCreateOneWithoutManyInput",
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
                "type": "OneOptionalCreateWithoutManyInput",
                "kind": "object",
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
                "type": "OneOptionalWhereUniqueInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OneOptionalUpdateOneWithoutManyInput",
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
                "type": "OneOptionalCreateWithoutManyInput",
                "kind": "object",
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
                "type": "OneOptionalWhereUniqueInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "disconnect",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "delete",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
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
                "type": "OneOptionalUpdateWithoutManyDataInput",
                "kind": "object",
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
                "type": "OneOptionalUpsertWithoutManyInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide2CreateOneWithoutOptiInput",
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
                "type": "OptionalSide2CreateWithoutOptiInput",
                "kind": "object",
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
                "type": "OptionalSide2WhereUniqueInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide2UpdateOneWithoutOptiInput",
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
                "type": "OptionalSide2CreateWithoutOptiInput",
                "kind": "object",
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
                "type": "OptionalSide2WhereUniqueInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "disconnect",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "delete",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
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
                "type": "OptionalSide2UpdateWithoutOptiDataInput",
                "kind": "object",
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
                "type": "OptionalSide2UpsertWithoutOptiInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide1CreateOneWithoutOptiInput",
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
                "type": "OptionalSide1CreateWithoutOptiInput",
                "kind": "object",
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
                "type": "OptionalSide1WhereUniqueInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide1UpdateOneWithoutOptiInput",
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
                "type": "OptionalSide1CreateWithoutOptiInput",
                "kind": "object",
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
                "type": "OptionalSide1WhereUniqueInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "disconnect",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "delete",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
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
                "type": "OptionalSide1UpdateWithoutOptiDataInput",
                "kind": "object",
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
                "type": "OptionalSide1UpsertWithoutOptiInput",
                "kind": "object",
                "isList": false
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedIntFilter",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NestedDateTimeFilter",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "type": "DateTime",
                "kind": "scalar",
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
                "type": "DateTime",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedDateTimeFilter",
                "kind": "object",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedStringFilter",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NestedStringNullableFilter",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "equals",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "in",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "notIn",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "not",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedStringNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedBoolFilter",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NestedIntNullableFilter",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "equals",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "in",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "notIn",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "not",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedIntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NestedFloatFilter",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedFloatFilter",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NestedFloatNullableFilter",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "equals",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "in",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "notIn",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "lt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
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
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "not",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedFloatNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NestedEnumABeautifulEnumFilter",
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
                "type": "ABeautifulEnum",
                "kind": "enum",
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
                "type": "ABeautifulEnum",
                "kind": "enum",
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
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": true
              }
            ]
          },
          {
            "name": "not",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NestedEnumABeautifulEnumFilter",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NestedEnumABeautifulEnumNullableFilter",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "equals",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "in",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "notIn",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": true
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "not",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NestedEnumABeautifulEnumNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NestedBoolNullableFilter",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "equals",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "not",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NestedBoolNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "UserUpdateWithoutPostsDataInput",
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
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "type": "UserUpdateWithoutPostsDataInput",
                "kind": "object",
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
                "kind": "object",
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
            "name": "createdAt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "DateTime",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "title",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "content",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "scalar",
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
                "kind": "object",
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
                "type": "PostUpdateWithoutAuthorDataInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "PostUpdateManyWithWhereNestedInput",
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
                "kind": "object",
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
                "type": "PostUpdateManyDataInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostScalarWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostScalarWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "PostScalarWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "createdAt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "DateTimeFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "DateTime",
                "kind": "scalar",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "content",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "StringNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
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
                "kind": "object",
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
                "type": "PostUpdateWithoutAuthorDataInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NCreateWithoutMInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NUpdateWithWhereUniqueWithoutMInput",
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
                "type": "NWhereUniqueInput",
                "kind": "object",
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
                "type": "NUpdateWithoutMDataInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NUpdateManyWithWhereNestedInput",
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
                "type": "NScalarWhereInput",
                "kind": "object",
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
                "type": "NUpdateManyDataInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NScalarWhereInput",
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
                "type": "NScalarWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NScalarWhereInput",
                "kind": "object",
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
                "type": "NScalarWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NScalarWhereInput",
                "kind": "object",
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
                "type": "NScalarWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "NScalarWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "IntFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "IntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "FloatFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "FloatNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "StringFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "StringNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonNullableFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "BoolFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "BoolNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NUpsertWithWhereUniqueWithoutMInput",
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
                "type": "NWhereUniqueInput",
                "kind": "object",
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
                "type": "NUpdateWithoutMDataInput",
                "kind": "object",
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
                "type": "NCreateWithoutMInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "MCreateWithoutNInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "MUpdateWithWhereUniqueWithoutNInput",
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
                "type": "MWhereUniqueInput",
                "kind": "object",
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
                "type": "MUpdateWithoutNDataInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "MUpdateManyWithWhereNestedInput",
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
                "type": "MScalarWhereInput",
                "kind": "object",
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
                "type": "MUpdateManyDataInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "MScalarWhereInput",
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
                "type": "MScalarWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MScalarWhereInput",
                "kind": "object",
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
                "type": "MScalarWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MScalarWhereInput",
                "kind": "object",
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
                "type": "MScalarWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "MScalarWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "IntFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "IntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "FloatFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "FloatNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "StringFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "StringNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonNullableFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "BoolFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "BoolNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "MUpsertWithWhereUniqueWithoutNInput",
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
                "type": "MWhereUniqueInput",
                "kind": "object",
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
                "type": "MUpdateWithoutNDataInput",
                "kind": "object",
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
                "type": "MCreateWithoutNInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredCreateWithoutOneInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredUpdateWithWhereUniqueWithoutOneInput",
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
                "type": "ManyRequiredWhereUniqueInput",
                "kind": "object",
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
                "type": "ManyRequiredUpdateWithoutOneDataInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredUpdateManyWithWhereNestedInput",
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
                "type": "ManyRequiredScalarWhereInput",
                "kind": "object",
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
                "type": "ManyRequiredUpdateManyDataInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredScalarWhereInput",
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
                "type": "ManyRequiredScalarWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredScalarWhereInput",
                "kind": "object",
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
                "type": "ManyRequiredScalarWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredScalarWhereInput",
                "kind": "object",
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
                "type": "ManyRequiredScalarWhereInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ManyRequiredScalarWhereInput",
                "kind": "object",
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
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "oneOptionalId",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "IntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "IntFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "IntNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "FloatFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "FloatNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "StringFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "StringNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "JsonNullableFilter",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "EnumABeautifulEnumNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "BoolFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "BoolNullableFilter",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredUpsertWithWhereUniqueWithoutOneInput",
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
                "type": "ManyRequiredWhereUniqueInput",
                "kind": "object",
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
                "type": "ManyRequiredUpdateWithoutOneDataInput",
                "kind": "object",
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
                "type": "ManyRequiredCreateWithoutOneInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OneOptionalCreateWithoutManyInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OneOptionalUpdateWithoutManyDataInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OneOptionalUpsertWithoutManyInput",
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
                "type": "OneOptionalUpdateWithoutManyDataInput",
                "kind": "object",
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
                "type": "OneOptionalCreateWithoutManyInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide2CreateWithoutOptiInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide2UpdateWithoutOptiDataInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide2UpsertWithoutOptiInput",
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
                "type": "OptionalSide2UpdateWithoutOptiDataInput",
                "kind": "object",
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
                "type": "OptionalSide2CreateWithoutOptiInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide1CreateWithoutOptiInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": true,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide1UpdateWithoutOptiDataInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "OptionalSide1UpsertWithoutOptiInput",
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
                "type": "OptionalSide1UpdateWithoutOptiDataInput",
                "kind": "object",
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
                "type": "OptionalSide1CreateWithoutOptiInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "PostUpdateWithoutAuthorDataInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "createdAt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "DateTime",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "DateTimeFieldUpdateOperationsInput",
                "kind": "object",
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
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "content",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "PostUpdateManyDataInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "createdAt",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "DateTime",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "DateTimeFieldUpdateOperationsInput",
                "kind": "object",
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
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "content",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
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
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NUpdateWithoutMDataInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "NUpdateManyDataInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "MUpdateWithoutNDataInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "MUpdateManyDataInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredUpdateWithoutOneDataInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      },
      {
        "name": "ManyRequiredUpdateManyDataInput",
        "constraints": {
          "maxNumFields": null,
          "minNumFields": null
        },
        "fields": [
          {
            "name": "int",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "IntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalInt",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Int",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableIntFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "float",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "FloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalFloat",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Float",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableFloatFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "string",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "StringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalString",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "String",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableStringFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "json",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalJson",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Json",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "enum",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "EnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalEnum",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "ABeautifulEnum",
                "kind": "enum",
                "isList": false
              },
              {
                "type": "NullableEnumABeautifulEnumFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          },
          {
            "name": "boolean",
            "isRequired": false,
            "isNullable": false,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "BoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              }
            ]
          },
          {
            "name": "optionalBoolean",
            "isRequired": false,
            "isNullable": true,
            "inputTypes": [
              {
                "type": "Boolean",
                "kind": "scalar",
                "isList": false
              },
              {
                "type": "NullableBoolFieldUpdateOperationsInput",
                "kind": "object",
                "isList": false
              },
              {
                "type": "Null",
                "kind": "scalar",
                "isList": false
              }
            ]
          }
        ]
      }
    ],
    "outputTypes": [
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
                    "kind": "object",
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
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "PostOrderByInput",
                    "kind": "object",
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
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Post",
              "kind": "object",
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
                    "kind": "object",
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
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "PostOrderByInput",
                    "kind": "object",
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
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Post",
              "kind": "object",
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
                    "kind": "object",
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
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "PostOrderByInput",
                    "kind": "object",
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
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "AggregatePost",
              "kind": "object",
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
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Post",
              "kind": "object",
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
                    "kind": "object",
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
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "UserOrderByInput",
                    "kind": "object",
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
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "User",
              "kind": "object",
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
                    "kind": "object",
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
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "UserOrderByInput",
                    "kind": "object",
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
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "User",
              "kind": "object",
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
                    "kind": "object",
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
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "UserOrderByInput",
                    "kind": "object",
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
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "AggregateUser",
              "kind": "object",
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
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "User",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findFirstM",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "MWhereInput",
                    "kind": "object",
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
                    "type": "MOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "MOrderByInput",
                    "kind": "object",
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
                    "type": "MWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "MDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "M",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findManyM",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "MWhereInput",
                    "kind": "object",
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
                    "type": "MOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "MOrderByInput",
                    "kind": "object",
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
                    "type": "MWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "MDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "M",
              "kind": "object",
              "isList": true
            }
          },
          {
            "name": "aggregateM",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "MWhereInput",
                    "kind": "object",
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
                    "type": "MOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "MOrderByInput",
                    "kind": "object",
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
                    "type": "MWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "MDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "AggregateM",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findOneM",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "MWhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "M",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findFirstN",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "NWhereInput",
                    "kind": "object",
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
                    "type": "NOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "NOrderByInput",
                    "kind": "object",
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
                    "type": "NWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "NDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "N",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findManyN",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "NWhereInput",
                    "kind": "object",
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
                    "type": "NOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "NOrderByInput",
                    "kind": "object",
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
                    "type": "NWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "NDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "N",
              "kind": "object",
              "isList": true
            }
          },
          {
            "name": "aggregateN",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "NWhereInput",
                    "kind": "object",
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
                    "type": "NOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "NOrderByInput",
                    "kind": "object",
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
                    "type": "NWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "NDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "AggregateN",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findOneN",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "NWhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "N",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findFirstOneOptional",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OneOptionalWhereInput",
                    "kind": "object",
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
                    "type": "OneOptionalOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "OneOptionalOrderByInput",
                    "kind": "object",
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
                    "type": "OneOptionalWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "OneOptionalDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OneOptional",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findManyOneOptional",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OneOptionalWhereInput",
                    "kind": "object",
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
                    "type": "OneOptionalOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "OneOptionalOrderByInput",
                    "kind": "object",
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
                    "type": "OneOptionalWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "OneOptionalDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "OneOptional",
              "kind": "object",
              "isList": true
            }
          },
          {
            "name": "aggregateOneOptional",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OneOptionalWhereInput",
                    "kind": "object",
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
                    "type": "OneOptionalOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "OneOptionalOrderByInput",
                    "kind": "object",
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
                    "type": "OneOptionalWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "OneOptionalDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "AggregateOneOptional",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findOneOneOptional",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OneOptionalWhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OneOptional",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findFirstManyRequired",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "ManyRequiredWhereInput",
                    "kind": "object",
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
                    "type": "ManyRequiredOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "ManyRequiredOrderByInput",
                    "kind": "object",
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
                    "type": "ManyRequiredWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "ManyRequiredDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ManyRequired",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findManyManyRequired",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "ManyRequiredWhereInput",
                    "kind": "object",
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
                    "type": "ManyRequiredOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "ManyRequiredOrderByInput",
                    "kind": "object",
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
                    "type": "ManyRequiredWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "ManyRequiredDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "ManyRequired",
              "kind": "object",
              "isList": true
            }
          },
          {
            "name": "aggregateManyRequired",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "ManyRequiredWhereInput",
                    "kind": "object",
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
                    "type": "ManyRequiredOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "ManyRequiredOrderByInput",
                    "kind": "object",
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
                    "type": "ManyRequiredWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "ManyRequiredDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "AggregateManyRequired",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findOneManyRequired",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "ManyRequiredWhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ManyRequired",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findFirstOptionalSide1",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide1WhereInput",
                    "kind": "object",
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
                    "type": "OptionalSide1OrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "OptionalSide1OrderByInput",
                    "kind": "object",
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
                    "type": "OptionalSide1WhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "OptionalSide1DistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide1",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findManyOptionalSide1",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide1WhereInput",
                    "kind": "object",
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
                    "type": "OptionalSide1OrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "OptionalSide1OrderByInput",
                    "kind": "object",
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
                    "type": "OptionalSide1WhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "OptionalSide1DistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "OptionalSide1",
              "kind": "object",
              "isList": true
            }
          },
          {
            "name": "aggregateOptionalSide1",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide1WhereInput",
                    "kind": "object",
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
                    "type": "OptionalSide1OrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "OptionalSide1OrderByInput",
                    "kind": "object",
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
                    "type": "OptionalSide1WhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "OptionalSide1DistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "AggregateOptionalSide1",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findOneOptionalSide1",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide1WhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide1",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findFirstOptionalSide2",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide2WhereInput",
                    "kind": "object",
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
                    "type": "OptionalSide2OrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "OptionalSide2OrderByInput",
                    "kind": "object",
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
                    "type": "OptionalSide2WhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "OptionalSide2DistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide2",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findManyOptionalSide2",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide2WhereInput",
                    "kind": "object",
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
                    "type": "OptionalSide2OrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "OptionalSide2OrderByInput",
                    "kind": "object",
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
                    "type": "OptionalSide2WhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "OptionalSide2DistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "OptionalSide2",
              "kind": "object",
              "isList": true
            }
          },
          {
            "name": "aggregateOptionalSide2",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide2WhereInput",
                    "kind": "object",
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
                    "type": "OptionalSide2OrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "OptionalSide2OrderByInput",
                    "kind": "object",
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
                    "type": "OptionalSide2WhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "OptionalSide2DistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "AggregateOptionalSide2",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "findOneOptionalSide2",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide2WhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide2",
              "kind": "object",
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
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Post",
              "kind": "object",
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
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Post",
              "kind": "object",
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
                    "kind": "object",
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
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Post",
              "kind": "object",
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
                    "kind": "object",
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
                    "kind": "object",
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
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Post",
              "kind": "object",
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
                    "kind": "object",
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
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
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
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
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
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "User",
              "kind": "object",
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
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "User",
              "kind": "object",
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
                    "kind": "object",
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
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "User",
              "kind": "object",
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
                    "kind": "object",
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
                    "kind": "object",
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
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "User",
              "kind": "object",
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
                    "kind": "object",
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
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
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
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "createOneM",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "MCreateInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "M",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "deleteOneM",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "MWhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "M",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "updateOneM",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "MUpdateInput",
                    "kind": "object",
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
                    "type": "MWhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "M",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "upsertOneM",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "MWhereUniqueInput",
                    "kind": "object",
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
                    "type": "MCreateInput",
                    "kind": "object",
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
                    "type": "MUpdateInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "M",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "updateManyM",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "MUpdateManyMutationInput",
                    "kind": "object",
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
                    "type": "MWhereInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "deleteManyM",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "MWhereInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "createOneN",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "NCreateInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "N",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "deleteOneN",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "NWhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "N",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "updateOneN",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "NUpdateInput",
                    "kind": "object",
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
                    "type": "NWhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "N",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "upsertOneN",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "NWhereUniqueInput",
                    "kind": "object",
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
                    "type": "NCreateInput",
                    "kind": "object",
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
                    "type": "NUpdateInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "N",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "updateManyN",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "NUpdateManyMutationInput",
                    "kind": "object",
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
                    "type": "NWhereInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "deleteManyN",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "NWhereInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "createOneOneOptional",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OneOptionalCreateInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "OneOptional",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "deleteOneOneOptional",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OneOptionalWhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OneOptional",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "updateOneOneOptional",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OneOptionalUpdateInput",
                    "kind": "object",
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
                    "type": "OneOptionalWhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OneOptional",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "upsertOneOneOptional",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OneOptionalWhereUniqueInput",
                    "kind": "object",
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
                    "type": "OneOptionalCreateInput",
                    "kind": "object",
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
                    "type": "OneOptionalUpdateInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "OneOptional",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "updateManyOneOptional",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OneOptionalUpdateManyMutationInput",
                    "kind": "object",
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
                    "type": "OneOptionalWhereInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "deleteManyOneOptional",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OneOptionalWhereInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "createOneManyRequired",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "ManyRequiredCreateInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "ManyRequired",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "deleteOneManyRequired",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "ManyRequiredWhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ManyRequired",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "updateOneManyRequired",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "ManyRequiredUpdateInput",
                    "kind": "object",
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
                    "type": "ManyRequiredWhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ManyRequired",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "upsertOneManyRequired",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "ManyRequiredWhereUniqueInput",
                    "kind": "object",
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
                    "type": "ManyRequiredCreateInput",
                    "kind": "object",
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
                    "type": "ManyRequiredUpdateInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "ManyRequired",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "updateManyManyRequired",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "ManyRequiredUpdateManyMutationInput",
                    "kind": "object",
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
                    "type": "ManyRequiredWhereInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "deleteManyManyRequired",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "ManyRequiredWhereInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "createOneOptionalSide1",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide1CreateInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "OptionalSide1",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "deleteOneOptionalSide1",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide1WhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide1",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "updateOneOptionalSide1",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide1UpdateInput",
                    "kind": "object",
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
                    "type": "OptionalSide1WhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide1",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "upsertOneOptionalSide1",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide1WhereUniqueInput",
                    "kind": "object",
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
                    "type": "OptionalSide1CreateInput",
                    "kind": "object",
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
                    "type": "OptionalSide1UpdateInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "OptionalSide1",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "updateManyOptionalSide1",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide1UpdateManyMutationInput",
                    "kind": "object",
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
                    "type": "OptionalSide1WhereInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "deleteManyOptionalSide1",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide1WhereInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "createOneOptionalSide2",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide2CreateInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "OptionalSide2",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "deleteOneOptionalSide2",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide2WhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide2",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "updateOneOptionalSide2",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide2UpdateInput",
                    "kind": "object",
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
                    "type": "OptionalSide2WhereUniqueInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide2",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "upsertOneOptionalSide2",
            "args": [
              {
                "name": "where",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide2WhereUniqueInput",
                    "kind": "object",
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
                    "type": "OptionalSide2CreateInput",
                    "kind": "object",
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
                    "type": "OptionalSide2UpdateInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "OptionalSide2",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "updateManyOptionalSide2",
            "args": [
              {
                "name": "data",
                "isRequired": true,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide2UpdateManyMutationInput",
                    "kind": "object",
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
                    "type": "OptionalSide2WhereInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "deleteManyOptionalSide2",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "OptionalSide2WhereInput",
                    "kind": "object",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "BatchPayload",
              "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
                    "isList": false
                  }
                ]
              }
            ],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
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
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "createdAt",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "DateTime",
              "kind": "scalar",
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
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "content",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "String",
              "kind": "scalar",
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
              "kind": "scalar",
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
              "kind": "object",
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
              "kind": "scalar",
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
              "kind": "scalar",
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
              "kind": "object",
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
              "kind": "object",
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
              "kind": "object",
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
              "kind": "object",
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
              "kind": "scalar",
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
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "string",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "String",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalString",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "String",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "json",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalJson",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "enum",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "ABeautifulEnum",
              "kind": "enum",
              "isList": false
            }
          },
          {
            "name": "optionalEnum",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ABeautifulEnum",
              "kind": "enum",
              "isList": false
            }
          },
          {
            "name": "boolean",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Boolean",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalBoolean",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Boolean",
              "kind": "scalar",
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
                    "kind": "object",
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
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "PostOrderByInput",
                    "kind": "object",
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
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Post",
              "kind": "object",
              "isList": true
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
              "kind": "scalar",
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
              "kind": "object",
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
              "kind": "object",
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
              "kind": "object",
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
              "kind": "object",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "M",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "n",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "NWhereInput",
                    "kind": "object",
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
                    "type": "NOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "NOrderByInput",
                    "kind": "object",
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
                    "type": "NWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "NDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "N",
              "kind": "object",
              "isList": true
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "string",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "String",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalString",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "String",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "json",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalJson",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "enum",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "ABeautifulEnum",
              "kind": "enum",
              "isList": false
            }
          },
          {
            "name": "optionalEnum",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ABeautifulEnum",
              "kind": "enum",
              "isList": false
            }
          },
          {
            "name": "boolean",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Boolean",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalBoolean",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Boolean",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "AggregateM",
        "fields": [
          {
            "name": "count",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "avg",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "MAvgAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "sum",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "MSumAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "min",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "MMinAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "max",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "MMaxAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "N",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "m",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "MWhereInput",
                    "kind": "object",
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
                    "type": "MOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "MOrderByInput",
                    "kind": "object",
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
                    "type": "MWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "MDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "M",
              "kind": "object",
              "isList": true
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "string",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "String",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalString",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "String",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "json",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalJson",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "enum",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "ABeautifulEnum",
              "kind": "enum",
              "isList": false
            }
          },
          {
            "name": "optionalEnum",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ABeautifulEnum",
              "kind": "enum",
              "isList": false
            }
          },
          {
            "name": "boolean",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Boolean",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalBoolean",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Boolean",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "AggregateN",
        "fields": [
          {
            "name": "count",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "avg",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "NAvgAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "sum",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "NSumAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "min",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "NMinAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "max",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "NMaxAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OneOptional",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "many",
            "args": [
              {
                "name": "where",
                "isRequired": false,
                "isNullable": false,
                "inputTypes": [
                  {
                    "type": "ManyRequiredWhereInput",
                    "kind": "object",
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
                    "type": "ManyRequiredOrderByInput",
                    "kind": "object",
                    "isList": true
                  },
                  {
                    "type": "ManyRequiredOrderByInput",
                    "kind": "object",
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
                    "type": "ManyRequiredWhereUniqueInput",
                    "kind": "object",
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
                    "kind": "scalar",
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
                    "kind": "scalar",
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
                    "type": "ManyRequiredDistinctFieldEnum",
                    "kind": "enum",
                    "isList": true
                  }
                ]
              }
            ],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ManyRequired",
              "kind": "object",
              "isList": true
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "string",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "String",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalString",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "String",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "json",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalJson",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "enum",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "ABeautifulEnum",
              "kind": "enum",
              "isList": false
            }
          },
          {
            "name": "optionalEnum",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ABeautifulEnum",
              "kind": "enum",
              "isList": false
            }
          },
          {
            "name": "boolean",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Boolean",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalBoolean",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Boolean",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "AggregateOneOptional",
        "fields": [
          {
            "name": "count",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "avg",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OneOptionalAvgAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "sum",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OneOptionalSumAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "min",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OneOptionalMinAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "max",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OneOptionalMaxAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "ManyRequired",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "one",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OneOptional",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "oneOptionalId",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "string",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "String",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalString",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "String",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "json",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalJson",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "enum",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "ABeautifulEnum",
              "kind": "enum",
              "isList": false
            }
          },
          {
            "name": "optionalEnum",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ABeautifulEnum",
              "kind": "enum",
              "isList": false
            }
          },
          {
            "name": "boolean",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Boolean",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalBoolean",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Boolean",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "AggregateManyRequired",
        "fields": [
          {
            "name": "count",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "avg",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ManyRequiredAvgAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "sum",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ManyRequiredSumAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "min",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ManyRequiredMinAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "max",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ManyRequiredMaxAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OptionalSide1",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "opti",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide2",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "optionalSide2Id",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "string",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "String",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalString",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "String",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "json",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalJson",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "enum",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "ABeautifulEnum",
              "kind": "enum",
              "isList": false
            }
          },
          {
            "name": "optionalEnum",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ABeautifulEnum",
              "kind": "enum",
              "isList": false
            }
          },
          {
            "name": "boolean",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Boolean",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalBoolean",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Boolean",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "AggregateOptionalSide1",
        "fields": [
          {
            "name": "count",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "avg",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide1AvgAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "sum",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide1SumAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "min",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide1MinAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "max",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide1MaxAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OptionalSide2",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "opti",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide1",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "string",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "String",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalString",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "String",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "json",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalJson",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Json",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "enum",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "ABeautifulEnum",
              "kind": "enum",
              "isList": false
            }
          },
          {
            "name": "optionalEnum",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "ABeautifulEnum",
              "kind": "enum",
              "isList": false
            }
          },
          {
            "name": "boolean",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Boolean",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalBoolean",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Boolean",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "AggregateOptionalSide2",
        "fields": [
          {
            "name": "count",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "avg",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide2AvgAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "sum",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide2SumAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "min",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide2MinAggregateOutputType",
              "kind": "object",
              "isList": false
            }
          },
          {
            "name": "max",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "OptionalSide2MaxAggregateOutputType",
              "kind": "object",
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
              "kind": "scalar",
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
              "kind": "scalar",
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
              "kind": "scalar",
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
              "kind": "scalar",
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
              "kind": "scalar",
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
              "kind": "scalar",
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
              "kind": "scalar",
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
              "kind": "scalar",
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
              "kind": "scalar",
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
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
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
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
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
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
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
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "MAvgAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "MSumAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "MMinAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "MMaxAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "NAvgAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "NSumAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "NMinAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "NMaxAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OneOptionalAvgAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OneOptionalSumAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OneOptionalMinAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OneOptionalMaxAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "ManyRequiredAvgAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "oneOptionalId",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "ManyRequiredSumAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "oneOptionalId",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "ManyRequiredMinAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "oneOptionalId",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "ManyRequiredMaxAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "oneOptionalId",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OptionalSide1AvgAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalSide2Id",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OptionalSide1SumAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalSide2Id",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OptionalSide1MinAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalSide2Id",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OptionalSide1MaxAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalSide2Id",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OptionalSide2AvgAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OptionalSide2SumAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OptionalSide2MinAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      },
      {
        "name": "OptionalSide2MaxAggregateOutputType",
        "fields": [
          {
            "name": "id",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "int",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalInt",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Int",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "float",
            "args": [],
            "isRequired": true,
            "isNullable": false,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          },
          {
            "name": "optionalFloat",
            "args": [],
            "isRequired": false,
            "isNullable": true,
            "outputType": {
              "type": "Float",
              "kind": "scalar",
              "isList": false
            }
          }
        ]
      }
    ],
    "enums": [
      {
        "name": "PostDistinctFieldEnum",
        "values": [
          "id",
          "createdAt",
          "title",
          "content",
          "published",
          "authorId"
        ]
      },
      {
        "name": "UserDistinctFieldEnum",
        "values": [
          "id",
          "email",
          "int",
          "optionalInt",
          "float",
          "optionalFloat",
          "string",
          "optionalString",
          "json",
          "optionalJson",
          "enum",
          "optionalEnum",
          "boolean",
          "optionalBoolean"
        ]
      },
      {
        "name": "MDistinctFieldEnum",
        "values": [
          "id",
          "int",
          "optionalInt",
          "float",
          "optionalFloat",
          "string",
          "optionalString",
          "json",
          "optionalJson",
          "enum",
          "optionalEnum",
          "boolean",
          "optionalBoolean"
        ]
      },
      {
        "name": "NDistinctFieldEnum",
        "values": [
          "id",
          "int",
          "optionalInt",
          "float",
          "optionalFloat",
          "string",
          "optionalString",
          "json",
          "optionalJson",
          "enum",
          "optionalEnum",
          "boolean",
          "optionalBoolean"
        ]
      },
      {
        "name": "OneOptionalDistinctFieldEnum",
        "values": [
          "id",
          "int",
          "optionalInt",
          "float",
          "optionalFloat",
          "string",
          "optionalString",
          "json",
          "optionalJson",
          "enum",
          "optionalEnum",
          "boolean",
          "optionalBoolean"
        ]
      },
      {
        "name": "ManyRequiredDistinctFieldEnum",
        "values": [
          "id",
          "oneOptionalId",
          "int",
          "optionalInt",
          "float",
          "optionalFloat",
          "string",
          "optionalString",
          "json",
          "optionalJson",
          "enum",
          "optionalEnum",
          "boolean",
          "optionalBoolean"
        ]
      },
      {
        "name": "OptionalSide1DistinctFieldEnum",
        "values": [
          "id",
          "optionalSide2Id",
          "int",
          "optionalInt",
          "float",
          "optionalFloat",
          "string",
          "optionalString",
          "json",
          "optionalJson",
          "enum",
          "optionalEnum",
          "boolean",
          "optionalBoolean"
        ]
      },
      {
        "name": "OptionalSide2DistinctFieldEnum",
        "values": [
          "id",
          "int",
          "optionalInt",
          "float",
          "optionalFloat",
          "string",
          "optionalString",
          "json",
          "optionalJson",
          "enum",
          "optionalEnum",
          "boolean",
          "optionalBoolean"
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
        "name": "ABeautifulEnum",
        "values": [
          "A",
          "B",
          "C"
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
  "mappings": [
    {
      "model": "Post",
      "plural": "posts",
      "findOne": "findOnePost",
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
      "findOne": "findOneUser",
      "findFirst": "findFirstUser",
      "findMany": "findManyUser",
      "create": "createOneUser",
      "delete": "deleteOneUser",
      "update": "updateOneUser",
      "deleteMany": "deleteManyUser",
      "updateMany": "updateManyUser",
      "upsert": "upsertOneUser",
      "aggregate": "aggregateUser"
    },
    {
      "model": "M",
      "plural": "ms",
      "findOne": "findOneM",
      "findFirst": "findFirstM",
      "findMany": "findManyM",
      "create": "createOneM",
      "delete": "deleteOneM",
      "update": "updateOneM",
      "deleteMany": "deleteManyM",
      "updateMany": "updateManyM",
      "upsert": "upsertOneM",
      "aggregate": "aggregateM"
    },
    {
      "model": "N",
      "plural": "ns",
      "findOne": "findOneN",
      "findFirst": "findFirstN",
      "findMany": "findManyN",
      "create": "createOneN",
      "delete": "deleteOneN",
      "update": "updateOneN",
      "deleteMany": "deleteManyN",
      "updateMany": "updateManyN",
      "upsert": "upsertOneN",
      "aggregate": "aggregateN"
    },
    {
      "model": "OneOptional",
      "plural": "oneOptionals",
      "findOne": "findOneOneOptional",
      "findFirst": "findFirstOneOptional",
      "findMany": "findManyOneOptional",
      "create": "createOneOneOptional",
      "delete": "deleteOneOneOptional",
      "update": "updateOneOneOptional",
      "deleteMany": "deleteManyOneOptional",
      "updateMany": "updateManyOneOptional",
      "upsert": "upsertOneOneOptional",
      "aggregate": "aggregateOneOptional"
    },
    {
      "model": "ManyRequired",
      "plural": "manyRequireds",
      "findOne": "findOneManyRequired",
      "findFirst": "findFirstManyRequired",
      "findMany": "findManyManyRequired",
      "create": "createOneManyRequired",
      "delete": "deleteOneManyRequired",
      "update": "updateOneManyRequired",
      "deleteMany": "deleteManyManyRequired",
      "updateMany": "updateManyManyRequired",
      "upsert": "upsertOneManyRequired",
      "aggregate": "aggregateManyRequired"
    },
    {
      "model": "OptionalSide1",
      "plural": "optionalSide1s",
      "findOne": "findOneOptionalSide1",
      "findFirst": "findFirstOptionalSide1",
      "findMany": "findManyOptionalSide1",
      "create": "createOneOptionalSide1",
      "delete": "deleteOneOptionalSide1",
      "update": "updateOneOptionalSide1",
      "deleteMany": "deleteManyOptionalSide1",
      "updateMany": "updateManyOptionalSide1",
      "upsert": "upsertOneOptionalSide1",
      "aggregate": "aggregateOptionalSide1"
    },
    {
      "model": "OptionalSide2",
      "plural": "optionalSide2s",
      "findOne": "findOneOptionalSide2",
      "findFirst": "findFirstOptionalSide2",
      "findMany": "findManyOptionalSide2",
      "create": "createOneOptionalSide2",
      "delete": "deleteOneOptionalSide2",
      "update": "updateOneOptionalSide2",
      "deleteMany": "deleteManyOptionalSide2",
      "updateMany": "updateManyOptionalSide2",
      "upsert": "upsertOneOptionalSide2",
      "aggregate": "aggregateOptionalSide2"
    }
  ]
}