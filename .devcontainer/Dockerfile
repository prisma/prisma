# See https://github.com/microsoft/vscode-dev-containers/tree/main/containers/codespaces-linux

FROM mcr.microsoft.com/vscode/devcontainers/universal

# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

# [Optional] Uncomment if you want to install an additional version of node using nvm
# ARG EXTRA_NODE_VERSION=10
# RUN su node -c "source /usr/local/share/nvm/nvm.sh && nvm install ${EXTRA_NODE_VERSION}"

# To install more global node packages
RUN su node -c "npm install -g pnpm@6 ts-node"
