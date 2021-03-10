#!/usr/bin/env node

// Inlined because always running npx is slow
// from https://github.com/pnpm/only-allow/blob/c9cd3039b365454c8f064a8304bac0ec7fc6d5fa/bin.js

const whichPMRuns = require("which-pm-runs");
const boxen = require("boxen");

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.log(
    "Please specify the wanted package manager: only-allow <npm|pnpm|yarn>"
  );
  process.exit(1);
}

const wantedPM = argv[0];
if (wantedPM !== "npm" && wantedPM !== "pnpm" && wantedPM !== "yarn") {
  console.log(
    `"${wantedPM}" is not a valid package manager. Available package managers are: npm, pnpm, or yarn.`
  );
  process.exit(1);
}

const usedPM = whichPMRuns();

if (usedPM && usedPM.name !== wantedPM) {
  const boxenOpts = { borderColor: "red", borderStyle: "double", padding: 1 };
  switch (wantedPM) {
    case "npm":
      console.log(
        boxen('Use "npm install" for installation in this project', boxenOpts)
      );
      break;
    case "pnpm":
      console.log(
        boxen(
          `Use "pnpm install" for installation in this project.

If you don't have pnpm, install it via "npm i -g pnpm".
For more details, go to https://pnpm.js.org/`,
          boxenOpts
        )
      );
      break;
    case "yarn":
      console.log(
        boxen(
          `Use "yarn" for installation in this project.

If you don't have Yarn, install it via "npm i -g yarn".
For more details, go to https://yarnpkg.com/`,
          boxenOpts
        )
      );
      break;
  }
  process.exit(1);
}
