import { Octokit } from '@octokit/rest';

export interface GitHubRequester {
  request(route: string, parameters?: Record<string, unknown>): Promise<{ data: any }>;
}

export function createGitHubRequester(token: string, baseUrl = 'https://api.github.com'): GitHubRequester {
  const octokit = new Octokit({
    auth: token,
    baseUrl,
    userAgent: 'github-manager-mcp/0.1.0',
  });

  return {
    request: (route, parameters = {}) => octokit.request(route as any, parameters as any),
  };
}

function splitRepository(repository: string): { owner: string; repo: string } {
  const [owner, repo, ...rest] = repository.split('/');
  if (!owner || !repo || rest.length > 0) {
    throw new Error(`Invalid repository '${repository}'. Expected owner/name.`);
  }
  return { owner, repo };
}

function repoSummary(data: any) {
  return {
    id: data.id,
    node_id: data.node_id,
    full_name: data.full_name,
    html_url: data.html_url,
    visibility: data.visibility,
    private: data.private,
    archived: data.archived,
    default_branch: data.default_branch,
  };
}

export class GitHubManager {
  constructor(private readonly github: GitHubRequester) {}

  async whoAmI() {
    const { data } = await this.github.request('GET /user');
    return {
      login: data.login,
      id: data.id,
      name: data.name,
      html_url: data.html_url,
    };
  }

  async createRepository(input: {
    name: string;
    organization?: string;
    description?: string;
    visibility?: 'public' | 'private' | 'internal';
    auto_init?: boolean;
    gitignore_template?: string;
    license_template?: string;
    has_issues?: boolean;
    has_projects?: boolean;
    has_wiki?: boolean;
  }) {
    const route = input.organization ? 'POST /orgs/{org}/repos' : 'POST /user/repos';
    const parameters: Record<string, unknown> = {
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      auto_init: input.auto_init ?? false,
      gitignore_template: input.gitignore_template,
      license_template: input.license_template,
      has_issues: input.has_issues,
      has_projects: input.has_projects,
      has_wiki: input.has_wiki,
    };
    if (input.organization) parameters.org = input.organization;

    const { data } = await this.github.request(route, parameters);
    return repoSummary(data);
  }

  async createFromTemplate(input: {
    template_repository: string;
    name: string;
    owner?: string;
    description?: string;
    include_all_branches?: boolean;
    private?: boolean;
  }) {
    const template = splitRepository(input.template_repository);
    const { data } = await this.github.request('POST /repos/{template_owner}/{template_repo}/generate', {
      template_owner: template.owner,
      template_repo: template.repo,
      owner: input.owner,
      name: input.name,
      description: input.description,
      include_all_branches: input.include_all_branches ?? false,
      private: input.private,
    });
    return repoSummary(data);
  }

  async updateRepository(input: {
    repository: string;
    name?: string;
    description?: string | null;
    homepage?: string | null;
    visibility?: 'public' | 'private' | 'internal';
    archived?: boolean;
    has_issues?: boolean;
    has_projects?: boolean;
    has_wiki?: boolean;
    default_branch?: string;
    allow_squash_merge?: boolean;
    allow_merge_commit?: boolean;
    allow_rebase_merge?: boolean;
    allow_auto_merge?: boolean;
    delete_branch_on_merge?: boolean;
  }) {
    const { owner, repo } = splitRepository(input.repository);
    const { repository: _repository, ...changes } = input;
    const { data } = await this.github.request('PATCH /repos/{owner}/{repo}', {
      owner,
      repo,
      ...changes,
    });
    return repoSummary(data);
  }

  async deleteRepository(repository: string, confirm_repository: string) {
    if (confirm_repository !== repository) {
      throw new Error('Refusing to delete: confirm_repository must exactly match repository.');
    }
    const { owner, repo } = splitRepository(repository);
    await this.github.request('DELETE /repos/{owner}/{repo}', { owner, repo });
    return { deleted: true, repository };
  }

  async replaceTopics(repository: string, topics: string[]) {
    const { owner, repo } = splitRepository(repository);
    const { data } = await this.github.request('PUT /repos/{owner}/{repo}/topics', {
      owner,
      repo,
      names: topics,
    });
    return { repository, topics: data.names ?? topics };
  }

  async dispatchWorkflow(input: {
    repository: string;
    workflow_id: string;
    ref: string;
    inputs?: Record<string, string | number | boolean>;
  }) {
    const { owner, repo } = splitRepository(input.repository);
    const { data } = await this.github.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
      owner,
      repo,
      workflow_id: input.workflow_id,
      ref: input.ref,
      inputs: input.inputs,
    });
    return {
      repository: input.repository,
      workflow_id: input.workflow_id,
      ref: input.ref,
      workflow_run_id: data?.workflow_run_id,
      run_url: data?.run_url,
      html_url: data?.html_url,
      dispatched: true,
    };
  }

  async createRelease(input: {
    repository: string;
    tag_name: string;
    target_commitish?: string;
    name?: string;
    body?: string;
    draft?: boolean;
    prerelease?: boolean;
    generate_release_notes?: boolean;
  }) {
    const { owner, repo } = splitRepository(input.repository);
    const { repository: _repository, ...release } = input;
    const { data } = await this.github.request('POST /repos/{owner}/{repo}/releases', {
      owner,
      repo,
      ...release,
    });
    return {
      id: data.id,
      tag_name: data.tag_name,
      name: data.name,
      draft: data.draft,
      prerelease: data.prerelease,
      html_url: data.html_url,
    };
  }
}
