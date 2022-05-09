#!/bin/bash

set -ex

npm i --silent -g pnpm@6 --unsafe-perm

pnpm i

pnpm run setup
