# GitHub Manager

Use this MCP server as a complement to the host's normal GitHub connector.

## Routing rules

1. Prefer the native/first-party GitHub connector for repository contents, issues, pull requests, reviews, ordinary commits, and CI inspection when it supports the requested operation.
2. Use GitHub Manager for explicit administrative operations that the native connector does not expose, such as creating repositories, changing repository settings, dispatching workflows, or creating releases.
3. Never ask the user to paste a PAT into chat. Authentication belongs in the MCP server process configuration.
4. Treat `delete_repository` as destructive. Call it only when the user explicitly requested deletion of that exact repository; repeat the exact `owner/name` in `confirm_repository`.
5. Do not infer organization ownership or visibility. Preserve the user's stated target and visibility.
6. After a mutating call, report the resulting repository/release/run URL when returned by GitHub.

## Security model

The model never needs to see the PAT. The MCP process holds the token and exposes a deliberately small set of named GitHub operations. Prefer adding another explicit tool over adding a generic arbitrary REST request tool.
