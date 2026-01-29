# @prisma/param-graph

This package is intended for Prisma's internal use.

Contains the ParamGraph types and utilities for schema-aware query parameterization in Prisma Client.

ParamGraph is a compact data structure generated from DMMF (Data Model Metadata Format) at client generation time. It enables precise, schema-driven parameterization of query values at runtime.

## Contents

- `ParamGraph` - The main type representing the compact schema
- `InputNode` / `OutputNode` - Node types for input arguments and output selections
- `InputEdge` / `OutputEdge` - Edge types describing field capabilities
- `EdgeFlag` - Bit flags for input field capabilities
- `ScalarMask` - Bit mask for scalar type categories
- `scalarTypeToMask` - Maps DMMF scalar type names to mask values
- `hasFlag` / `getScalarMask` - Helper functions for edge inspection
