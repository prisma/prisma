#!/bin/bash

#
# Test version command
#
VERSION=$(node ./build/index.js --version)
if [[ ${VERSION} != *"@prisma/cli"* ]]; then
  echo "prisma --version is broken"
  exit 1
fi

#
# Test introspection output with warnings
#
cd fixtures/introspection-warnings
INTROSPECTION=$(node ../../build/index.js introspect --url="file:./warnings.db")
if [[ ${INTROSPECTION} != *"column_name_that_becomes_empty_string"* ]]; then
  echo "prisma introspect column_name_that_becomes_empty_string is broken"
  exit 1
fi
if [[ ${INTROSPECTION} != *"no_unique_identifier"* ]]; then
  echo "prisma introspect no_unique_identifier is broken"
  exit 1
fi
if [[ ${INTROSPECTION} != *"unsupported_type"* ]]; then
  echo "prisma introspect unsupported_type is broken"
  exit 1
fi
cd ../../

#
# Test generate output command
#
cd fixtures/project/subdir
GENERATE=$(node ../../../build/index.js generate)
if [[ ${GENERATE} != *"Generated "* ]]; then
  echo "prisma generate is broken"
  exit 1
fi

#
# Test --schema from schema dir
#

# Relative path
GENERATE_RELATIVE_SCHEMA_PATH="./schema.prisma"
GENERATE_RELATIVE_SCHEMA=$(node ../../../build/index.js generate --schema=$GENERATE_RELATIVE_SCHEMA_PATH)
if [[ ${GENERATE_RELATIVE_SCHEMA} != *"Generated "* ]]; then
  echo "prisma generate --schema=$GENERATE_RELATIVE_SCHEMA_PATH is broken"
  exit 1
fi
# Same case but should fail!
GENERATE_RELATIVE_SCHEMA_INVALID_PATH="./invalid.prisma"
GENERATE_RELATIVE_SCHEMA_INVALID=$(node ../../../build/index.js generate --schema=$GENERATE_RELATIVE_SCHEMA_INVALID_PATH 2>&1 > /dev/null)
if [[ ${GENERATE_RELATIVE_SCHEMA_INVALID} != *"Provided --schema at $GENERATE_RELATIVE_SCHEMA_INVALID_PATH doesn't exist."* ]]; then
  echo "prisma generate --schema=$GENERATE_RELATIVE_SCHEMA_INVALID_PATH is broken (should fail)"
  exit 1
fi

# Absolute path
GENERATE_ABSOLUTE_SCHEMA_PATH="$(pwd)/schema.prisma"
GENERATE_ABSOLUTE_SCHEMA=$(node ../../../build/index.js generate --schema=$GENERATE_ABSOLUTE_SCHEMA_PATH)
if [[ ${GENERATE_ABSOLUTE_SCHEMA} != *"Generated "* ]]; then
  echo "prisma generate --schema=$GENERATE_ABSOLUTE_SCHEMA_PATH is broken"
  exit 1
fi
# Same case but should fail!
GENERATE_ABSOLUTE_SCHEMA_INVALID_PATH="$(pwd)/invalid.prisma"
GENERATE_ABSOLUTE_SCHEMA_INVALID=$(node ../../../build/index.js generate --schema=$GENERATE_ABSOLUTE_SCHEMA_INVALID_PATH 2>&1 > /dev/null)
if [[ ${GENERATE_ABSOLUTE_SCHEMA_INVALID} != *"Provided --schema at $GENERATE_ABSOLUTE_SCHEMA_INVALID_PATH doesn't exist"* ]]; then
  echo "prisma generate --schema=$GENERATE_ABSOLUTE_SCHEMA_INVALID_PATH is broken (should fail)"
  exit 1
fi
cd ../../..

#
# Test generation in npm script
#
rm -rf fixtures/project/subdir/@prisma
cd fixtures/project/ && yarn postinstall

#
# Test --schema from parent dir
#
cd ../..
# Relative path
GENERATE_RELATIVE_SCHEMA_FROM_PARENT_PATH="./fixtures/project/subdir/schema.prisma"
GENERATE_RELATIVE_SCHEMA_FROM_PARENT=$(SQLITE_URL=file:dev.db node ./build/index.js generate --schema=$GENERATE_RELATIVE_SCHEMA_FROM_PARENT_PATH)
if [[ ${GENERATE_RELATIVE_SCHEMA_FROM_PARENT} != *"Generated "* ]]; then
  echo "prisma generate --schema=$GENERATE_RELATIVE_SCHEMA_FROM_PARENT_PATH is broken"
  exit 1
fi
# Same case but should fail!
GENERATE_RELATIVE_SCHEMA_FROM_PARENT_INVALID_PATH="./fixtures/project/subdir/invalid.prisma"
GENERATE_RELATIVE_SCHEMA_FROM_PARENT_INVALID=$(node ./build/index.js generate --schema=$GENERATE_RELATIVE_SCHEMA_FROM_PARENT_INVALID_PATH 2>&1 > /dev/null)
if [[ ${GENERATE_RELATIVE_SCHEMA_FROM_PARENT_INVALID} != *"Provided --schema at $GENERATE_RELATIVE_SCHEMA_FROM_PARENT_INVALID_PATH doesn't exist."* ]]; then
  echo "prisma generate --schema=$GENERATE_RELATIVE_SCHEMA_FROM_PARENT_INVALID_PATH is broken (should fail)"
  exit 1
fi

# Absolute path
GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_PATH="$(pwd)/fixtures/project/subdir/schema.prisma"
GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT=$(SQLITE_URL=file:dev.db node ./build/index.js generate --schema=$GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_PATH)
if [[ ${GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT} != *"Generated "* ]]; then
  echo "prisma generate --schema=$GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_PATH is broken"
  exit 1
fi
# Same case but should fail!
GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_INVALID_PATH="$(pwd)/fixtures/project/subdir/invalid.prisma"
GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_INVALID=$(node ./build/index.js generate --schema=$GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_INVALID_PATH 2>&1 > /dev/null)
if [[ ${GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_INVALID} != *"Provided --schema at $GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_INVALID_PATH doesn't exist."* ]]; then
  echo "prisma generate --schema=$GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_INVALID_PATH is broken (should fail)"
  exit 1
fi
