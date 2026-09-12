# github_manager

A small, explicit MCP server that complements a normal GitHub connector with administrative actions backed by a user-supplied GitHub Personal Access Token (PAT).

The motivating use case is deliberately simple: an agent may already be able to edit files, work with pull requests, and inspect Actions through its built-in GitHub connector, while still lacking repository-administration operations such as **creating a new repository**. `github_manager` fills that gap without exposing an unrestricted "call any GitHub endpoint" tool.

## Tools in v0.1

| Tool | Purpose |
| --- | --- |
| `github_whoami` | Verify which account the PAT authenticates as |
| `create_repository` | Create a repository for the authenticated user or an organization |
| `create_repository_from_template` | Generate a repository from a GitHub template |
| `update_repository` | Change metadata and selected repository settings |
| `set_repository_topics` | Replace repository topics |
| `dispatch_workflow` | Trigger a `workflow_dispatch` GitHub Actions workflow |
| `create_release` | Create a GitHub release |
| `delete_repository` | Permanently delete a repository, with exact-name confirmation |

The server intentionally has **no generic arbitrary REST tool**. Adding named operations keeps the agent-facing capability surface understandable, auditable, and easier to permission safely.

## Security model

The PAT is configuration for the MCP process. **Do not paste it into a chat, prompt, skill file, source file, Docker image, or Git repository.**

For a fine-grained PAT, grant only the repository/organization access and permissions needed for the tools you plan to use. Repository creation and most settings changes require repository **Administration: write**. Workflow dispatch requires **Actions: write**. Repository deletion requires **Administration: write**; classic PATs additionally use the `delete_repo` scope.

HTTP mode can optionally require a second shared secret (`MCP_BEARER_TOKEN`) to protect the MCP endpoint itself. This is distinct from the GitHub PAT.

## Quick start: stdio

Requires Node.js 20+ (Node 22 recommended).

```bash
npm install
npm run build

export GITHUB_TOKEN='github_pat_...'
node dist/index.js
```

`stdio` is the default transport and is suitable for MCP hosts that launch local child processes.

Example MCP client configuration:

```json
{
  "mcpServers": {
    "github-manager": {
      "command": "node",
      "args": ["/absolute/path/to/github_manager/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

Exact environment-variable interpolation syntax varies by client. Prefer the client's secret/environment mechanism over putting a literal PAT in a checked-in config file.

## Remote HTTP mode

ChatGPT connects to remote MCP servers rather than directly spawning local stdio servers. Run the service behind HTTPS (normally via a reverse proxy or a hosting platform):

```bash
export GITHUB_TOKEN='github_pat_...'
export GITHUB_MANAGER_TRANSPORT=http
export HOST=127.0.0.1
export PORT=3000
export MCP_BEARER_TOKEN='a-long-random-secret-for-the-mcp-endpoint'

npm start
```

Endpoints:

- `POST /mcp` — MCP Streamable HTTP endpoint
- `GET /health` — minimal health check; never returns credentials

If `MCP_BEARER_TOKEN` is set, `/mcp` requires:

```text
Authorization: Bearer <MCP_BEARER_TOKEN>
```

Do not bind an unauthenticated server directly to the public Internet. Put TLS in front of it, keep logs free of authorization headers, and use a narrowly scoped PAT.

### ChatGPT note

ChatGPT custom apps use a remote MCP endpoint. Availability of write-capable custom MCP apps depends on the ChatGPT plan/workspace and current product rollout. The server itself is ordinary MCP and is not tied to ChatGPT, so the same code can also be used by Codex/IDE/desktop MCP clients.

## Docker

```bash
docker build -t github-manager .

docker run --rm \
  -e GITHUB_TOKEN='github_pat_...' \
  -e GITHUB_MANAGER_TRANSPORT=http \
  -e HOST=0.0.0.0 \
  -e PORT=3000 \
  -e MCP_BEARER_TOKEN='replace-with-a-long-random-secret' \
  -p 3000:3000 \
  github-manager
```

## Configuration

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | yes | — | Fine-grained or classic GitHub PAT |
| `GITHUB_API_URL` | no | `https://api.github.com` | GitHub API base URL; can point at GitHub Enterprise Server |
| `GITHUB_MANAGER_TRANSPORT` | no | `stdio` | `stdio` or `http` |
| `HOST` | HTTP only | `127.0.0.1` | HTTP bind host |
| `PORT` | HTTP only | `3000` | HTTP bind port |
| `MCP_BEARER_TOKEN` | recommended for remote HTTP | — | Separate secret protecting `/mcp` |

Copy `.env.example` only as a reference; the server deliberately does not auto-load `.env`, so deployment remains explicit and secrets are not silently pulled from the working directory.

## Design

`src/github.ts` contains a small GitHub REST adapter and the actual operations. `src/server.ts` maps those operations to typed MCP tools with read/destructive/idempotency annotations. `src/index.ts` contains only transport wiring.

The included agent guidance under `skills/github-manager/SKILL.md` tells a capable host to prefer its native GitHub connector for ordinary Git work and use this server only for missing administration actions.

## Development

```bash
npm install
npm run check
```

CI compiles the TypeScript project and runs unit tests on every push and pull request.

## Adding a capability

Prefer one explicit tool per coherent GitHub operation:

1. add the REST call to `GitHubManager`;
2. expose a narrow Zod input schema in `buildServer`;
3. set MCP annotations honestly (`readOnlyHint`, `destructiveHint`, `idempotentHint`);
4. add at least one unit test for routing/guard behavior;
5. document the PAT permission needed.

Avoid a generic `github_request(method, path, body)` escape hatch unless the threat model is intentionally changed.

## License

MIT
