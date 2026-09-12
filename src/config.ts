import { z } from 'zod';

const schema = z.object({
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),
  GITHUB_API_URL: z.string().url().default('https://api.github.com'),
  GITHUB_MANAGER_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default('127.0.0.1'),
  MCP_BEARER_TOKEN: z.string().min(16).optional(),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return schema.parse(env);
}
