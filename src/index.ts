#!/usr/bin/env node
import express from 'express';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig } from './config.js';
import { createGitHubRequester, GitHubManager } from './github.js';
import { buildServer } from './server.js';

async function runStdio(manager: GitHubManager) {
  const server = buildServer(manager);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('github-manager MCP listening on stdio');
}

async function runHttp(manager: GitHubManager, host: string, port: number, bearerToken?: string) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'github-manager', version: '0.1.0' });
  });

  app.use('/mcp', (req, res, next) => {
    if (!bearerToken) return next();
    const expected = `Bearer ${bearerToken}`;
    if (req.header('authorization') !== expected) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  });

  app.post('/mcp', async (req, res) => {
    const server = buildServer(manager);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close().catch(() => undefined);
      server.close().catch(() => undefined);
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP request failed:', error);
      if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
    }
  });

  app.all('/mcp', (req, res) => {
    if (req.method === 'POST') return;
    res.status(405).set('Allow', 'POST').end();
  });

  app.listen(port, host, () => {
    console.error(`github-manager MCP listening on http://${host}:${port}/mcp`);
    if (!bearerToken && host !== '127.0.0.1' && host !== 'localhost') {
      console.error('WARNING: HTTP endpoint is externally bound without MCP_BEARER_TOKEN.');
    }
  });
}

async function main() {
  const config = loadConfig();
  const manager = new GitHubManager(createGitHubRequester(config.GITHUB_TOKEN, config.GITHUB_API_URL));

  if (config.GITHUB_MANAGER_TRANSPORT === 'http') {
    await runHttp(manager, config.HOST, config.PORT, config.MCP_BEARER_TOKEN);
  } else {
    await runStdio(manager);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
