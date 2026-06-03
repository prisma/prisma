# Node 22: the e2e `_steps.cts` files run as CommonJS and `require('zx')`
# (ESM-only), which throws ERR_VM_MODULE_LINK_FAILURE on Node 20 because
# `require()` of ESM is only enabled by default from Node 22.12 onward. Node 22
# also satisfies `@prisma/streams-local`'s `engines: >=22`.
FROM node:22

RUN npm -v

# zx is pinned to v7 because v8 fails with:
# [esbuild Error]: Top-level await is currently not supported with the "cjs" output format
# at /usr/local/lib/node_modules/zx/build/vendor.js:2:17
# pnpm is pinned (and matches the repo's `packageManager`): leaving it unpinned
# pulls the latest pnpm, which fails `pnpm install` here with
# ERR_PNPM_IGNORED_BUILDS because the standalone e2e projects don't carry the
# repo's `onlyBuiltDependencies` config for `prisma`/`@prisma/engines`.
RUN npm i -g \
  zx@7 \
  pnpm@10.15.1 \
  typescript@5.9.3 \
  ts-node \
  esbuild \
  tsx \
  jest \
  @swc/jest@0.2.32

RUN apt update && \
  apt install iproute2 jq -y

# install Bun runtime
# Set BUN_INSTALL explicitly and add to PATH
ENV BUN_INSTALL="/root/.bun"
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

# install Bun (respecting the BUN_INSTALL env var), and verify it's installed and accessible
RUN curl -fsSL https://bun.sh/install | bash && \
  ls -la ${BUN_INSTALL}/bin/bun && \
  bun --version

CMD chmod +x ./e2e/_utils/standard.cmd.sh && ./e2e/_utils/standard.cmd.sh
