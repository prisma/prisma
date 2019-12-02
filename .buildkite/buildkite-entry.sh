#!/bin/bash

set -ex

buildkite-agent pipeline upload .buildkite/trigger.yml
