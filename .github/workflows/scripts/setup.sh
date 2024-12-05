#!/bin/bash

set -ex

npm i --silent -g pnpm@8.15.5 --unsafe-perm

pnpm i

pnpm run build
