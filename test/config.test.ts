import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('defaults to stdio and api.github.com', () => {
    const config = loadConfig({ GITHUB_TOKEN: 'token' });
    expect(config.GITHUB_MANAGER_TRANSPORT).toBe('stdio');
    expect(config.GITHUB_API_URL).toBe('https://api.github.com');
  });

  it('rejects a short HTTP bearer token', () => {
    expect(() => loadConfig({ GITHUB_TOKEN: 'token', MCP_BEARER_TOKEN: 'short' })).toThrow();
  });
});
