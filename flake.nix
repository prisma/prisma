{
  description = "nix shell setup for Prisma TS development";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = import nixpkgs { inherit system; }; prisma-engines = pkgs.prisma-engines; in
      {
        devShell = pkgs.mkShell {
          buildInputs = with pkgs; [ nodejs-14_x nodePackages.pnpm makeWrapper ];
          shellHook = ''
            build () {
              echo "=~=~=~= installing dependencies...";
              pnpm i;
              echo "=~=~=~= building...";
              pnpm run build;
            }

            test () {
              pnpm run test;
            }

            use-nixpkgs-engine-binaries () {
              eval '
              export PRISMA_MIGRATION_ENGINE_BINARY=${prisma-engines}/bin/migration-engine \
              export PRISMA_QUERY_ENGINE_BINARY=${prisma-engines}/bin/query-engine \
              export PRISMA_QUERY_ENGINE_LIBRARY=${pkgs.lib.getLib prisma-engines}/lib/libquery_engine.node \
              export PRISMA_INTROSPECTION_ENGINE_BINARY=${prisma-engines}/bin/introspection-engine \
              export PRISMA_FMT_BINARY=${prisma-engines}/bin/prisma-fmt
              '
            }

            use-local-engine-binaries () {
              echo "Using binaries from $1"
              ROOT=$1;

              # o tempora, o mores
              cp -f $ROOT/libquery_engine.so $ROOT/libquery_engine.node

              eval "
              export PRISMA_MIGRATION_ENGINE_BINARY=$ROOT/migration-engine \
              export PRISMA_QUERY_ENGINE_BINARY=$ROOT/query-engine \
              export PRISMA_QUERY_ENGINE_LIBRARY=$ROOT/libquery_engine.node \
              export PRISMA_INTROSPECTION_ENGINE_BINARY=$ROOT/introspection-engine \
              export PRISMA_FMT_BINARY=$ROOT/prisma-fmt
              "
            }

            prisma-cli () {
              export INDEX_JS="./packages/cli/build/index.js";
              chmod +x $INDEX_JS;
              echo "> $INDEX_JS"
              $INDEX_JS $@
            }
          '';
        };
      }
    );
}

