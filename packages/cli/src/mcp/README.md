# Prisma MCP

MCP or [Model Context Protocol](https://docs.anthropic.com/en/docs/mcp) allows the Prisma ORM to wrap CLI commands into workflows that work well with LLMs and AI code editors.

## Using Prisma MCP

The Prisma ORM and CLI uses a locally run MCP server that wraps CLI commands like `prisma migrate` or `prisma db` and require local file access to run during development.

A list of MCP tools are in `./MCP.ts`.

### Starting The Server

Start the local CLI MCP server using `npx prisma mcp` or follow the [docs](https://www.prisma.io/docs/postgres/integrations/mcp-server) to add the local MCP Server to your code editor, LLM, or Agent.
