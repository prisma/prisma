#!/usr/bin/env node

// Inlined from
// https://github.com/zkochan/packages/blob/80a87115e134b2222124e1af91e01b074b4921b6/which-pm-runs/index.js
const whichPMRuns = function () {
  if (!process.env.npm_config_user_agent) {
    return undefined
  }
  return pmFromUserAgent(process.env.npm_config_user_agent)
}

function pmFromUserAgent(userAgent) {
  const pmSpec = userAgent.split(' ')[0]
  const separatorPos = pmSpec.lastIndexOf('/')
  return {
    name: pmSpec.substring(0, separatorPos),
    version: pmSpec.slice(separatorPos + 1),
  }
}

// Inlined because always running npx is slow
// from https://github.com/pnpm/only-allow/blob/c9cd3039b365454c8f064a8304bac0ec7fc6d5fa/bin.js
const argv = process.argv.slice(2)
if (argv.length === 0) {
  console.log('Please specify the wanted package manager: only-allow <npm|pnpm|yarn>\n')
  process.exit(1)
}

const wantedPM = argv[0]
if (wantedPM !== 'npm' && wantedPM !== 'pnpm' && wantedPM !== 'yarn') {
  console.log(`"${wantedPM}" is not a valid package manager. Available package managers are: npm, pnpm, or yarn.\n`)
  process.exit(1)
}

const usedPM = whichPMRuns()

if (usedPM && usedPM.name !== wantedPM) {
  switch (wantedPM) {
    case 'npm':
      console.log('Use "npm install" for installation in this project\n')
      break
    case 'pnpm':
      console.log(
        `Use "pnpm install" for installation in this project.

If you don't have pnpm, install it via "npm i -g pnpm".
For more details, go to https://pnpm.io/\n`,
      )
      break
    case 'yarn':
      console.log(
        `Use "yarn" for installation in this project.

If you don't have Yarn, install it via "npm i -g yarn".
For more details, go to https://yarnpkg.com/\n`,
      )
      break
  }
  process.exit(1)
}
