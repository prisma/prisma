#!/usr/bin/env node
/**
 * Wait for GitHub Actions check suites to complete for a given commit.
 *
 * Environment variables:
 * - COMMIT_SHA (required)
 * - GITHUB_OWNER (required)
 * - GITHUB_REPO (required)
 * - GITHUB_TOKEN (required) - token with `repo` scope (BOT token preferred)
 * - TIMEOUT_MINUTES (optional, default: 60)
 * - POLL_INTERVAL_SECONDS (optional, default: 60)
 *
 * Output: JSON printed to stdout, for example:
 * {
 *   "status": "success" | "failure" | "timeout" | "not-found",
 *   "durationSeconds": number,
 *   "failures": [
 *     { "name": "Workflow Name", "conclusion": "failure", "url": "..." }
 *   ]
 * }
 */

const https = require("node:https");

const failureConclusions = new Set([
  "failure",
  "timed_out",
  "cancelled",
  "action_required",
]);

function getEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    if (fallback === undefined) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return fallback;
  }
  return value;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, token) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          Accept: "application/vnd.github+json",
          "User-Agent": "prisma-sync-next-script",
        },
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          if (
            response.statusCode &&
            response.statusCode >= 200 &&
            response.statusCode < 300
          ) {
            try {
              resolve(JSON.parse(data || "null"));
            } catch (error) {
              reject(
                new Error(
                  `Failed to parse JSON response from ${url}: ${error.message}`,
                ),
              );
            }
          } else {
            reject(
              new Error(
                `GitHub API request failed (${response.statusCode} ${response.statusMessage}): ${data}`,
              ),
            );
          }
        });
      },
    );

    request.on("error", (error) => {
      reject(error);
    });

    request.end();
  });
}

async function collectFailuresForSuite(owner, repo, suite, token) {
  const failures = [];

  if (!suite.conclusion || !failureConclusions.has(suite.conclusion)) {
    return failures;
  }

  // Fetch individual check runs for more detailed information
  const runsUrl = `https://api.github.com/repos/${owner}/${repo}/check-suites/${suite.id}/check-runs?per_page=100`;
  const runsData = await fetchJson(runsUrl, token);
  const runs = runsData.check_runs || [];

  const failingRuns = runs.filter((run) =>
    failureConclusions.has(run.conclusion),
  );

  if (failingRuns.length === 0) {
    failures.push({
      name: suite.name,
      conclusion: suite.conclusion,
      url: suite.html_url,
    });
    return failures;
  }

  for (const run of failingRuns) {
    failures.push({
      name: run.name,
      conclusion: run.conclusion,
      url: run.html_url,
    });
  }

  return failures;
}

async function main() {
  const commit = getEnv("COMMIT_SHA");
  const owner = getEnv("GITHUB_OWNER");
  const repo = getEnv("GITHUB_REPO");
  const token = getEnv("GITHUB_TOKEN");
  const timeoutMinutes = Number.parseInt(getEnv("TIMEOUT_MINUTES", "60"), 10);
  const pollIntervalSeconds = Number.parseInt(
    getEnv("POLL_INTERVAL_SECONDS", "60"),
    10,
  );

  const startedAt = Date.now();
  const deadline = startedAt + timeoutMinutes * 60 * 1000;

  const result = {
    status: "not-found",
    durationSeconds: 0,
    failures: [],
  };

  while (Date.now() < deadline) {
    const suitesUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${commit}/check-suites?per_page=100`;

    let suitesData;
    try {
      suitesData = await fetchJson(suitesUrl, token);
    } catch (error) {
      // Retry on transient failures
      await sleep(pollIntervalSeconds * 1000);
      continue;
    }

    const suites =
      suitesData.check_suites?.filter(
        (suite) => suite.app?.slug === "github-actions",
      ) ?? [];

    if (suites.length === 0) {
      await sleep(pollIntervalSeconds * 1000);
      continue;
    }

    const incomplete = suites.some((suite) => suite.status !== "completed");
    if (incomplete) {
      await sleep(pollIntervalSeconds * 1000);
      continue;
    }

    const failures = [];
    for (const suite of suites) {
      const suiteFailures = await collectFailuresForSuite(
        owner,
        repo,
        suite,
        token,
      );
      failures.push(...suiteFailures);
    }

    result.durationSeconds = Math.round((Date.now() - startedAt) / 1000);

    if (failures.length > 0) {
      result.status = "failure";
      result.failures = failures;
    } else {
      result.status = "success";
    }

    process.stdout.write(JSON.stringify(result));
    return;
  }

  result.status = "timeout";
  result.durationSeconds = Math.round((Date.now() - startedAt) / 1000);
  process.stdout.write(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error.message);
  process.stdout.write(
    JSON.stringify({
      status: "error",
      durationSeconds: 0,
      failures: [
        {
          name: "exception",
          conclusion: "error",
          url: "",
          message: error.message,
        },
      ],
    }),
  );
  process.exitCode = 1;
});
