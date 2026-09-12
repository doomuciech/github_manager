import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GitHubManager } from './github.js';

function asToolResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

export function buildServer(manager: GitHubManager) {
  const server = new McpServer(
    { name: 'github-manager', version: '0.1.0' },
    {
      instructions:
        'GitHub administration tools backed by the configured PAT. Prefer narrower first-party GitHub tools when they can perform the same action. Treat destructive operations as high impact.',
    },
  );

  server.registerTool(
    'github_whoami',
    {
      title: 'GitHub identity',
      description: 'Return the GitHub account authenticated by the configured PAT.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try { return asToolResult(await manager.whoAmI()); } catch (error) { return fail(error); }
    },
  );

  server.registerTool(
    'create_repository',
    {
      title: 'Create GitHub repository',
      description:
        'Create a repository for the authenticated user, or inside an organization when organization is provided. Use this when the normal GitHub connector cannot create repositories.',
      inputSchema: z.object({
        name: z.string().min(1).max(100).describe('Repository name without owner.'),
        organization: z.string().min(1).optional().describe('Organization login. Omit to create for the authenticated user.'),
        description: z.string().max(350).optional(),
        visibility: z.enum(['public', 'private', 'internal']).default('private'),
        auto_init: z.boolean().default(true).describe('Initialize with an empty README commit.'),
        gitignore_template: z.string().optional(),
        license_template: z.string().optional(),
        has_issues: z.boolean().optional(),
        has_projects: z.boolean().optional(),
        has_wiki: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (input) => {
      try { return asToolResult(await manager.createRepository(input)); } catch (error) { return fail(error); }
    },
  );

  server.registerTool(
    'create_repository_from_template',
    {
      title: 'Create repository from template',
      description: 'Generate a new repository from a GitHub template repository.',
      inputSchema: z.object({
        template_repository: z.string().regex(/^[^/]+\/[^/]+$/).describe('Template repository as owner/name.'),
        name: z.string().min(1).max(100),
        owner: z.string().min(1).optional().describe('Target user or organization. Omit for the authenticated user.'),
        description: z.string().max(350).optional(),
        include_all_branches: z.boolean().default(false),
        private: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (input) => {
      try { return asToolResult(await manager.createFromTemplate(input)); } catch (error) { return fail(error); }
    },
  );

  server.registerTool(
    'update_repository',
    {
      title: 'Update repository settings',
      description: 'Update repository metadata and selected administrative settings.',
      inputSchema: z.object({
        repository: z.string().regex(/^[^/]+\/[^/]+$/),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(350).nullable().optional(),
        homepage: z.string().url().nullable().optional(),
        visibility: z.enum(['public', 'private', 'internal']).optional(),
        archived: z.boolean().optional(),
        has_issues: z.boolean().optional(),
        has_projects: z.boolean().optional(),
        has_wiki: z.boolean().optional(),
        default_branch: z.string().min(1).optional(),
        allow_squash_merge: z.boolean().optional(),
        allow_merge_commit: z.boolean().optional(),
        allow_rebase_merge: z.boolean().optional(),
        allow_auto_merge: z.boolean().optional(),
        delete_branch_on_merge: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (input) => {
      try { return asToolResult(await manager.updateRepository(input)); } catch (error) { return fail(error); }
    },
  );

  server.registerTool(
    'set_repository_topics',
    {
      title: 'Set repository topics',
      description: 'Replace all GitHub topics for a repository.',
      inputSchema: z.object({
        repository: z.string().regex(/^[^/]+\/[^/]+$/),
        topics: z.array(z.string().min(1).max(50)).max(20),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ repository, topics }) => {
      try { return asToolResult(await manager.replaceTopics(repository, topics)); } catch (error) { return fail(error); }
    },
  );

  server.registerTool(
    'dispatch_workflow',
    {
      title: 'Dispatch GitHub Actions workflow',
      description: 'Trigger a workflow_dispatch-enabled GitHub Actions workflow.',
      inputSchema: z.object({
        repository: z.string().regex(/^[^/]+\/[^/]+$/),
        workflow_id: z.string().min(1).describe('Workflow file name such as deploy.yml, or numeric workflow ID represented as text.'),
        ref: z.string().min(1).describe('Branch or tag to run the workflow from.'),
        inputs: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (input) => {
      try { return asToolResult(await manager.dispatchWorkflow(input)); } catch (error) { return fail(error); }
    },
  );

  server.registerTool(
    'create_release',
    {
      title: 'Create GitHub release',
      description: 'Create a GitHub release for an existing or new tag.',
      inputSchema: z.object({
        repository: z.string().regex(/^[^/]+\/[^/]+$/),
        tag_name: z.string().min(1),
        target_commitish: z.string().min(1).optional(),
        name: z.string().optional(),
        body: z.string().optional(),
        draft: z.boolean().default(false),
        prerelease: z.boolean().default(false),
        generate_release_notes: z.boolean().default(false),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (input) => {
      try { return asToolResult(await manager.createRelease(input)); } catch (error) { return fail(error); }
    },
  );

  server.registerTool(
    'delete_repository',
    {
      title: 'Delete GitHub repository',
      description:
        'Permanently delete a repository. confirm_repository must exactly equal repository. Use only after explicit user intent to delete that exact repository.',
      inputSchema: z.object({
        repository: z.string().regex(/^[^/]+\/[^/]+$/),
        confirm_repository: z.string().describe('Must exactly repeat repository, e.g. owner/name.'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ repository, confirm_repository }) => {
      try { return asToolResult(await manager.deleteRepository(repository, confirm_repository)); } catch (error) { return fail(error); }
    },
  );

  return server;
}
