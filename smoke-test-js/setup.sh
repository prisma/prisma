#!/usr/bin/env bash

cd .. || return
pnpm i && pnpm build
cargo build -p query-engine-node-api
cd smoke-test-js || exit
pnpm i