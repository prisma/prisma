# Original from https://github.com/microsoft/vscode-dev-containers/blob/main/containers/codespaces-linux/.devcontainer/Dockerfile
# More info https://github.com/microsoft/vscode-dev-containers/tree/main/containers/codespaces-linux
# Docker https://hub.docker.com/_/microsoft-vscode-devcontainers
# All tags https://mcr.microsoft.com/v2/vscode/devcontainers/universal/tags/list

FROM mcr.microsoft.com/vscode/devcontainers/universal:1-linux

USER root

# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

# To install npm global packages
RUN npm install -g pnpm@6 ts-node

USER codespace
