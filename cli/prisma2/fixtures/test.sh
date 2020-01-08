#!/bin/bash

# Test version command
VERSION=$(node ./build/index.js --version)
if [[ ${VERSION} != *"prisma2@"* ]]; then
  echo "prisma2 --version is broken"
  exit 1
fi


# Test generation in npm script
rm -rf fixtures/project/subdir/@generated
cd fixtures/project/ && yarn postinstall