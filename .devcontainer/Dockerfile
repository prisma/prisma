# Original from https://github.com/microsoft/vscode-dev-containers/blob/main/containers/codespaces-linux/.devcontainer/Dockerfile
# More info https://github.com/microsoft/vscode-dev-containers/tree/main/containers/codespaces-linux
# Docker https://hub.docker.com/_/microsoft-vscode-devcontainers
# All tags https://mcr.microsoft.com/v2/vscode/devcontainers/universal/tags/list

FROM mcr.microsoft.com/vscode/devcontainers/universal

USER root

# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

USER codespace

# RUN npm install -g pnpm@6 ts-node

# From https://pnpm.io/6.x/installation
RUN curl -f https://get.pnpm.io/v6.16.js | node - add --global pnpm@latest-6

# To install npm global packages as non root user
RUN pnpm install -g ts-node
