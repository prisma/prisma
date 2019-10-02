# Telemetry

The term **telemetry** refers to the collection of certain usage data to help _improve the quality of a piece of software_. Prisma 2 uses telemetry in the context of **error reports**. This page describes the overall telemetry approach for Prisma 2, what kind of data is collected and how to opt-out of data collection.

## TLDR

During the Preview period, upon an unexpected error you will _always_ be prompted whether you want to submit an error report in order to help improve the quality of the Prisma 2 tools. Error reports are never sent without your explicit consent and never contain personal or other sensitive information. The _exclusive_ purpose of this data collection is to accelerate the development of Prisma 2 towards a General Availability release.

## What kind of data is being collected?

The _exclusive_ purpose of telemetry is to improve the quality of the Prisma 2 tools: Photon, Lift, and Studio. Therefore, the only data that is being tracked relates to the actual _usage_ of these tools and not to any personal or other sensitive information!

Here's a list of information that is contained in an error report:

- Operating system
- Versions of Prisma tools
- Project metadata

_Project metadata_ includes your Prisma schema, used CLI commands or usage of certain features in the Photon API. Note that the connection details of any of your data sources will be obscured in the error report.

Here's a list of information that is **never** contained in an error report:

- User credentials (keys, secrets, passwords, ...)
- Database connection details (IP, port, database name, ...)

## Why is data collected?

The _exclusive_ purpose of telemetry is to improve the quality of the Prisma 2 tools: Photon, Lift, and Studio. By sharing information about what went wrong in any of the Prisma 2 tools, you can make an easy, yet extremely helpful, contribution to the development of Prisma 2. 

## When is data collected?

During the Preview period, data is potentially collected upon:

- a crash in the CLI
- a crash or an unexpected error in Prisma Studio

Before an error report is submitted, there will _always_ be a prompt asking you to confirm or deny the submission of the error report! Error reports are never submitted without your explicit consent!

## How to opt-out of data collection?

During the Preview period, you can opt-out of data collection by responding to the interactive prompt with _no_.

## Telemetry after the General Availability release

The way how telemetry is used during the [Preview period](https://github.com/prisma/prisma2/blob/master/docs/prisma2-feedback.md) differs from the way it'll be used after the General Availability release. This page will be continuously updated to reflect the future plans for telemetry. 