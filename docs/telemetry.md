# Telemetry

The term **telemetry** refers to the collection of certain usage data to help _improve the quality of a piece of software_. The Prisma Framework uses telemetry in two contexts:

- collecting usage data
- submitting error reports

This page describes the overall telemetry approach for the Prisma Framework, what kind of data is collected and how to opt-out of data collection.

## Why do we collect metrics?

Telemetry helps us better understand how many users are using our products and how often they are using our products. Unlike many telemetry services, our telemetry implementation is intentionally limited in scope and is actually useful for the developer:

- **Limited in scope**: We use telemetry to answer one question: how many monthly active developers are using Prisma?
- **Provides value**: Our telemetry service also checks for version updates and offers security notices.

## When is data collected?

Data is collected in two scenarios that are described below.

### Usage data

Invokations of the `prisma2` CLI sends information to the telemetry server at https://checkpoint.prisma.io. Note that this is only happening at most every 48 hours (i.e., the sending the data to the telemetry server gets pause for 48 hours after any invokation).

Here is an overview of the data that's being submitted:

|             Field |     Attributes      | Description                                                               |
| ----------------: | :-----------------: | :------------------------------------------------------------------------ |
|         `product` | _string, required_  | Name of the product. Current we only support `prisma`.                    |
|         `version` | _string, required_  | Currently installed version of the product (e.g. `1.0.0-rc0`)             |
|            `arch` | _string, optional_  | Client's operating system architecture (e.g. `amd64`).                    |
|              `os` | _string, optional_  | Client's operating system (e.g. `darwin`).                                |
|    `node_version` | _string, optional_  | Client's node version (e.g. `v12.12.0`).                                  |
|         `disable` | _boolean, required_ | Disable checking for an update if it's not already cached. Useful for CI. |
|        `endpoint` | _string, optional_  | Checkpoint server endpoint URL. Defaults to https://checkpoint.prisma.io. |
|         `timeout` | _number, optional_  | Time in milliseconds we should wait for a response before giving up.      |
|       `signature` | _string, optional_  | Random, non-identifiable signature to ensure alerts aren't repeated.      |
|      `cache_file` | _string, optional_  | File where we store the response for the `cache_duration`.                |
|  `cache_duration` | _number, optional_  | Time in milliseconds to store the response. Defaults to 48 hours.         |
| `remind_duration` | _number, optional_  | Time in milliseconds to wait for a new reminder. Defaults to 48 hours.    |
|           `force` | _boolean, optional_ | Force a check regardless of `disable` or `CHECKPOINT_DISABLE`.            |
|           `unref` | _boolean, optional_ | Control when we should unreference the child. Use with care.              |

You can opt-out of this behaviour by setting the `CHECKPOINT_DISABLE` environment variable to `1`, e.g.:

```bash
export CHECKPOINT_DISABLE=1
```

### Error reporting

During the Preview period, data is potentially collected upon:

- a crash in the CLI
- a crash or an unexpected error in Prisma Studio

Before an error report is submitted, there will _always_ be a prompt asking you to confirm or deny the submission of the error report! Error reports are never submitted without your explicit consent!

## How to opt-out of data collection?

### Usage data

You can opt-out of usage data collection by setting the `CHECKPOINT_DISABLE` environment variable to `1`, e.g.:

```bash
export CHECKPOINT_DISABLE=1
```

### Error reporting

You can opt-out of data collection by responding to the interactive prompt with _no_.

## Telemetry after the General Availability release

The way how telemetry is used during the [Preview period](https://github.com/prisma/prisma2/blob/master/docs/prisma2-feedback.md) differs from the way it'll be used after the General Availability release. This page will be continuously updated to reflect the future plans for telemetry. 