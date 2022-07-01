import { platforms } from '@prisma/get-platform'
import chalk from 'chalk'
import execa from 'execa'
import fetch from 'node-fetch'
import pMap from 'p-map'

import { getProxyAgent } from './getProxyAgent'
import { getDownloadUrl } from './util'

export async function getLatestTag(): Promise<any> {
  let branch = await getBranch()
  if (branch !== 'main' && !isPatchBranch(branch) && !branch.startsWith('integration/')) {
    branch = 'main'
  }

  // remove the "integration/" part
  branch = branch.replace(/^integration\//, '')
  // console.log({ branch }, 'after replace')

  // first try to get the branch as it is
  // if it doesn't have an equivalent in the engines repo
  // default back to main
  let commits = await getCommits(branch)
  if ((!commits || !Array.isArray(commits)) && branch !== 'main' && !isPatchBranch(branch)) {
    console.log(`Overwriting branch "${branch}" with "main" as it's not a branch we have engines for`)
    branch = 'main'
    commits = await getCommits(branch)
  }

  if (!Array.isArray(commits)) {
    console.error(commits)
    throw new Error(`Could not fetch commits from github: ${JSON.stringify(commits, null, 2)}`)
  }

  return getFirstFinishedCommit(branch, commits)
}

export function getAllUrls(branch: string, commit: string): string[] {
  const urls: string[] = []

  // these are the platforms we know exists but we don't compile for.
  // we need to exclude them here so that we don't try to download egnines for these.
  // They are known because we don't want to block custom engine usage for them.
  const excludedPlatforms = [
    'freebsd',
    'arm',
    'linux-nixos',
    'linux-arm-openssl-1.1.x',
    'linux-arm-openssl-1.0.x',
    'linux-arm-openssl-3.0.x',
    'openbsd',
    'netbsd',
    'freebsd11',
    'freebsd12',
    'freebsd13',
  ]
  const relevantPlatforms = platforms.filter((p) => !excludedPlatforms.includes(p))
  for (const platform of relevantPlatforms) {
    for (const engine of ['query-engine', 'introspection-engine', 'migration-engine', 'prisma-fmt']) {
      for (const extension of ['.gz', '.gz.sha256', '.gz.sig', '.sig', '.sha256']) {
        const downloadUrl = getDownloadUrl(branch, commit, platform, engine, extension)
        urls.push(downloadUrl)
      }
    }
  }

  return urls
}

async function getFirstFinishedCommit(branch: string, commits: string[]): Promise<string | void> {
  for (const commit of commits) {
    const urls = getAllUrls(branch, commit)
    // TODO: potential to speed things up
    // We don't always need to wait for the last commit
    const exist = await pMap(urls, urlExists, { concurrency: 10 })
    const hasMissing = exist.some((e) => !e)

    if (!hasMissing) {
      return commit
    } else {
      const missing = urls.filter((_, i) => !exist[i])
      // if all are missing, we don't have to talk about it
      // it might just be a broken commit or just still building
      if (missing.length !== urls.length) {
        console.log(
          `${chalk.blueBright(
            'info',
          )} The engine commit ${commit} is not yet done. We're skipping it as we're in dev. Missing urls: ${
            missing.length
          }`,
        )
      }
    }
  }
}

export async function urlExists(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      agent: getProxyAgent(url) as any,
    })

    const headers = fromEntries(res.headers.entries())
    if (res.status > 200) {
      // console.error(res, headers)
    }
    if (parseInt(headers['content-length']) > 0) {
      return res.status < 300
    }
  } catch (e) {
    //
    // console.error(e)
  }
  return false
}

function fromEntries<T>(entries: IterableIterator<[string, T]>): Record<string, T> {
  const result = {}
  for (const [key, value] of entries) {
    result[key] = value
  }
  return result
}

async function getBranch() {
  if (process.env.NODE_ENV !== 'test') {
    if (process.env.PATCH_BRANCH) {
      return process.env.PATCH_BRANCH
    }
    if (process.env.BUILDKITE_BRANCH) {
      return process.env.BUILDKITE_BRANCH
    }
    if (process.env.GITHUB_CONTEXT) {
      const context = JSON.parse(process.env.GITHUB_CONTEXT)
      return context.head_ref
    }
  }

  // Need to be handled
  // for example it's used in https://github.com/prisma/binary-tester and the environment
  // is not a git repository so it fails
  try {
    const result = await execa.command('git rev-parse --abbrev-ref HEAD', {
      shell: true,
      stdio: 'pipe',
    })
    return result.stdout
  } catch (e) {
    console.error(e)
  }

  return
}

// TODO: Adjust this for stable release
function isPatchBranch(version: string): boolean {
  return /^2\.(\d+)\.x/.test(version)
}

async function getCommits(branch: string): Promise<string[] | object> {
  // A simple cache in front of GitHub API that was implemented to avoid a rate-limit error in the past
  // See https://dash.cloudflare.com/c72786e48b88e7492830a60584c2ac13/workers/services/view/github-cache/production
  const url = `https://github-cache.prisma.workers.dev/repos/prisma/prisma-engines/commits?sha=${branch}`
  const result = await fetch(url, {
    agent: getProxyAgent(url) as any,
    // Headers are not used by the worker
    //     headers: {
    //       Authorization: process.env.GITHUB_TOKEN
    //         ? `token ${process.env.GITHUB_TOKEN}`
    //         : undefined,
    //     },
  } as any).then((res) => res.json())

  if (!Array.isArray(result)) {
    return result
  }

  const commits = result.map((r) => r.sha)
  return commits
}
