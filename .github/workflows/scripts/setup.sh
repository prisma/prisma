#!/bin/bash

set -ex

npm i --silent -g pnpm@8 --unsafe-perm

pnpm i

pnpm run setup
