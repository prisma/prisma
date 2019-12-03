#!/bin/bash

set -ex

node --version || echo ""
python --version || echo ""

buildkite-agent pipeline upload .buildkite/trigger.yml

