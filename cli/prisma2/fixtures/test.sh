#!/bin/bash

#
# Test version command
#
VERSION=$(node ./build/index.js --version)
if [[ ${VERSION} != *"prisma2@"* ]]; then
  echo "prisma2 --version is broken"
  exit 1
fi

#
# Test generate output command
#
cd fixtures/project/subdir
GENERATE=$(node ../../../build/index.js generate)
if [[ ${GENERATE} != *"Generated "* ]]; then
  echo "prisma2 generate is broken"
  exit 1
fi

#
# Test --schema from schema dir
#

# Relative path
GENERATE_RELATIVE_SCHEMA_PATH="./schema.prisma"
GENERATE_RELATIVE_SCHEMA=$(node ../../../build/index.js generate --schema=$GENERATE_RELATIVE_SCHEMA_PATH)
if [[ ${GENERATE_RELATIVE_SCHEMA} != *"Generated "* ]]; then
  echo "prisma2 generate --schema=$GENERATE_RELATIVE_SCHEMA_PATH is broken"
  exit 1
fi
# Same case but should fail!
GENERATE_RELATIVE_SCHEMA_INVALID_PATH="./invalid.prisma"
GENERATE_RELATIVE_SCHEMA_INVALID=$(node ../../../build/index.js generate --schema=$GENERATE_RELATIVE_SCHEMA_INVALID_PATH 2>&1 > /dev/null)
if [[ ${GENERATE_RELATIVE_SCHEMA_INVALID} != *"Provided --schema at $GENERATE_RELATIVE_SCHEMA_INVALID_PATH doesn't exist."* ]]; then
  echo "prisma2 generate --schema=$GENERATE_RELATIVE_SCHEMA_INVALID_PATH is broken (should fail)"
  exit 1
fi

# Absolute path
GENERATE_ABSOLUTE_SCHEMA_PATH="$(pwd)/schema.prisma"
GENERATE_ABSOLUTE_SCHEMA=$(node ../../../build/index.js generate --schema=$GENERATE_ABSOLUTE_SCHEMA_PATH)
if [[ ${GENERATE_ABSOLUTE_SCHEMA} != *"Generated "* ]]; then
  echo "prisma2 generate --schema=$GENERATE_ABSOLUTE_SCHEMA_PATH is broken"
  exit 1
fi
# Same case but should fail!
GENERATE_ABSOLUTE_SCHEMA_INVALID_PATH="$(pwd)/invalid.prisma"
GENERATE_ABSOLUTE_SCHEMA_INVALID=$(node ../../../build/index.js generate --schema=$GENERATE_ABSOLUTE_SCHEMA_INVALID_PATH 2>&1 > /dev/null)
if [[ ${GENERATE_ABSOLUTE_SCHEMA_INVALID} != *"Provided --schema at $GENERATE_ABSOLUTE_SCHEMA_INVALID_PATH doesn't exist"* ]]; then
  echo "prisma2 generate --schema=$GENERATE_ABSOLUTE_SCHEMA_INVALID_PATH is broken (should fail)"
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
GENERATE_RELATIVE_SCHEMA_FROM_PARENT=$(node ./build/index.js generate --schema=$GENERATE_RELATIVE_SCHEMA_FROM_PARENT_PATH)
if [[ ${GENERATE_RELATIVE_SCHEMA_FROM_PARENT} != *"Generated "* ]]; then
  echo "prisma2 generate --schema=$GENERATE_RELATIVE_SCHEMA_FROM_PARENT_PATH is broken"
  exit 1
fi
# Same case but should fail!
GENERATE_RELATIVE_SCHEMA_FROM_PARENT_INVALID_PATH="./fixtures/project/subdir/invalid.prisma"
GENERATE_RELATIVE_SCHEMA_FROM_PARENT_INVALID=$(node ./build/index.js generate --schema=$GENERATE_RELATIVE_SCHEMA_FROM_PARENT_INVALID_PATH 2>&1 > /dev/null)
if [[ ${GENERATE_RELATIVE_SCHEMA_FROM_PARENT_INVALID} != *"Provided --schema at $GENERATE_RELATIVE_SCHEMA_FROM_PARENT_INVALID_PATH doesn't exist."* ]]; then
  echo "prisma2 generate --schema=$GENERATE_RELATIVE_SCHEMA_FROM_PARENT_INVALID_PATH is broken (should fail)"
  exit 1
fi

# Absolute path
GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_PATH="$(pwd)/fixtures/project/subdir/schema.prisma"
GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT=$(node ./build/index.js generate --schema=$GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_PATH)
if [[ ${GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT} != *"Generated "* ]]; then
  echo "prisma2 generate --schema=$GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_PATH is broken"
  exit 1
fi
# Same case but should fail!
GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_INVALID_PATH="$(pwd)/fixtures/project/subdir/invalid.prisma"
GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_INVALID=$(node ./build/index.js generate --schema=$GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_INVALID_PATH 2>&1 > /dev/null)
if [[ ${GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_INVALID} != *"Provided --schema at $GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_INVALID_PATH doesn't exist."* ]]; then
  echo "prisma2 generate --schema=$GENERATE_ABSOLUTE_SCHEMA_FROM_PARENT_INVALID_PATH is broken (should fail)"
  exit 1
fi
