#!/bin/bash

# Test version command
VERSION=$(node ./build/index.js --version)
if [[ ${VERSION} != *"prisma2@"* ]]; then
  echo "prisma2 --version is broken"
  exit 1
fi

# Test generate output command
cd fixtures/project/subdir
GENERATE=$(node ../../../build/index.js generate)
if [[ ${GENERATE} != *"Generated "* ]]; then
  echo "prisma2 generate is broken"
  exit 1
fi
cd ../../..


# Test generation in npm script
rm -rf fixtures/project/subdir/@prisma
cd fixtures/project/ && yarn postinstall