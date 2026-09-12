import { describe, expect, it, vi } from 'vitest';
import { GitHubManager, type GitHubRequester } from '../src/github.js';

function requester(response: any = {}) {
  const request = vi.fn(async () => ({ data: response }));
  return { request } as unknown as GitHubRequester & { request: ReturnType<typeof vi.fn> };
}

describe('GitHubManager', () => {
  it('creates a user repository with the expected REST endpoint', async () => {
    const api = requester({ id: 1, full_name: 'alice/demo', html_url: 'https://github.com/alice/demo', private: false });
    const manager = new GitHubManager(api);

    const result = await manager.createRepository({ name: 'demo', visibility: 'public', auto_init: true });

    expect(api.request).toHaveBeenCalledWith('POST /user/repos', expect.objectContaining({
      name: 'demo', visibility: 'public', auto_init: true,
    }));
    expect(result.full_name).toBe('alice/demo');
  });

  it('creates an organization repository through the organization endpoint', async () => {
    const api = requester({ id: 2, full_name: 'acme/demo' });
    const manager = new GitHubManager(api);

    await manager.createRepository({ name: 'demo', organization: 'acme' });

    expect(api.request).toHaveBeenCalledWith('POST /orgs/{org}/repos', expect.objectContaining({
      org: 'acme', name: 'demo',
    }));
  });

  it('requires exact repository confirmation before deletion', async () => {
    const api = requester();
    const manager = new GitHubManager(api);

    await expect(manager.deleteRepository('alice/demo', 'alice/other')).rejects.toThrow('confirm_repository');
    expect(api.request).not.toHaveBeenCalled();
  });

  it('dispatches workflows with inputs', async () => {
    const api = requester({ workflow_run_id: 42, html_url: 'https://github.com/alice/demo/actions/runs/42' });
    const manager = new GitHubManager(api);

    const result = await manager.dispatchWorkflow({
      repository: 'alice/demo', workflow_id: 'deploy.yml', ref: 'main', inputs: { environment: 'prod' },
    });

    expect(api.request).toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
      expect.objectContaining({ owner: 'alice', repo: 'demo', workflow_id: 'deploy.yml', ref: 'main' }),
    );
    expect(result.workflow_run_id).toBe(42);
  });
});
