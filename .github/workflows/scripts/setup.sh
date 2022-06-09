#!/bin/bash

set -ex

npm i --silent -g pnpm --unsafe-perm

pnpm i

pnpm run setup
