# Telemetry

The term **telemetry** refers to the collection of certain usage data to help _improve the quality of a piece of software_. Prisma 2 uses telemetry in two contexts:

- collecting usage data
- submitting error reports

This page describes the overall telemetry approach for Prisma 2, what kind of data is collected and how to opt-out of data collection.

## Why do we collect metrics?

Telemetry helps us better understand how many users are using our products and how often they are using our products. Unlike many telemetry services, our telemetry implementation is intentionally limited in scope and is actually useful for the developer:

- **Limited in scope**: We use telemetry to answer one question: how many monthly active developers are using Prisma?
- **Provides value**: Our telemetry service also checks for version updates and offers security notices.

## When is data collected?

Data is collected in two scenarios that are described below.

### Usage data

Invokations of the `prisma2` CLI sends information to the telemetry server at https://checkpoint.prisma.io. Note that this is only happening at most every 48 hours (i.e., the sending the data to the telemetry server gets pause for 48 hours after any invokation).

Here is an overview of the data that's being submitted:

|          Field | Attributes | Description                                                                            |
| -------------: | :--------: | :------------------------------------------------------------------------------------- |
|      `product` |  _string_  | Name of the product (e.g. `prisma`)                                                    |
|      `version` |  _string_  | Currently installed version of the product (e.g. `1.0.0-rc0`)                          |
|         `arch` |  _string_  | Client's operating system architecture (e.g. `amd64`).                                 |
|           `os` |  _string_  | Client's operating system (e.g. `darwin`).                                             |
| `node_version` |  _string_  | Client's node version (e.g. `v12.12.0`).                                               |
|    `signature` |  _string_  | Random, non-identifiable signature UUID (e.g. `91b014df3-9dda-4a27-a8a7-15474fd899f8`) |
|   `user_agent` |  _string_  | User agent of the checkpoint client (e.g. `prisma/js-checkpoint`)                      |
|    `timestamp` |  _string_  | When the request was made in RFC3339 format (e.g. `2019-12-12T17:45:56Z`)              |

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
