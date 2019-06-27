#!/bin/bash

set -ex
env

cd prisma2
yarn
yarn build
yarn test
cd ../introspection
yarn
yarn build
yarn test