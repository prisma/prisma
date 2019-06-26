#!/bin/bash

set -ex

yarn
yarn link
yarn link @prisma/lift
cd node_modules/@prisma/photon
yarn link @prisma/lift
cd ../../../
yarn test