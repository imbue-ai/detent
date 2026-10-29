import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.buildkite.com';
const PATH = '/mcp';
const toolRequest = (name: string, path = PATH) => mcpRequest(DOMAIN, path, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_GROUPS: Record<string, string[]> = {
  'buildkite-mcp-read-account': ['current_user', 'user_token_organization', 'access_token'],
  'buildkite-mcp-read-clusters': [
    'list_clusters',
    'get_cluster',
    'list_cluster_queues',
    'get_cluster_queue',
    'list_cluster_secrets',
    'get_cluster_secret',
    'list_cache_registries',
    'get_cache_registry',
  ],
  'buildkite-mcp-read-agents': ['list_agents', 'get_agent'],
  'buildkite-mcp-read-pipelines': [
    'list_pipelines',
    'get_pipeline',
    'validate_pipeline',
    'get_pipeline_github_webhook_processing',
    'list_pipeline_schedules',
    'get_pipeline_schedule',
    'list_repository_connections',
    'get_repository_connection',
  ],
  'buildkite-mcp-read-builds': [
    'list_builds',
    'get_build',
    'get_build_test_engine_runs',
    'wait_for_build',
    'list_step_uploads',
    'get_step_upload',
    'list_jobs',
    'get_job',
    'get_job_env',
    'get_build_failure_summary',
    'compare_builds',
    'list_annotations',
  ],
  'buildkite-mcp-read-logs': ['search_logs', 'tail_logs', 'read_logs'],
  'buildkite-mcp-read-artifacts': [
    'list_artifacts_for_build',
    'list_artifacts_for_job',
    'get_artifact',
  ],
  'buildkite-mcp-read-tests': [
    'list_tests',
    'list_tests_for_build',
    'get_test',
    'list_test_runs',
    'get_test_run',
    'get_failed_executions',
    'slowest_executions_for_build',
    'read_execution_trace',
    'list_test_suites_for_pipeline',
    'list_test_workflows',
    'get_test_workflow',
  ],
  'buildkite-mcp-read-skills': ['list_skills', 'load_skill'],
};

const WRITE_GROUPS: Record<string, string[]> = {
  'buildkite-mcp-write-clusters': [
    'create_cluster',
    'update_cluster',
    'create_cluster_queue',
    'update_cluster_queue',
    'pause_cluster_queue_dispatch',
    'resume_cluster_queue_dispatch',
    'create_cluster_secret',
    'create_cache_registry',
    'update_cache_registry',
    'set_default_cache_registry',
    'delete_cache_registry',
  ],
  'buildkite-mcp-write-pipelines': [
    'create_pipeline',
    'update_pipeline',
    'create_pipeline_webhook',
    'enable_pipeline_github_webhook_processing',
    'disable_pipeline_github_webhook_processing',
    'create_pipeline_schedule',
    'update_pipeline_schedule',
  ],
  'buildkite-mcp-write-builds': [
    'create_build',
    'cancel_build',
    'rebuild_build',
    'retry_job',
    'retry_failed_jobs',
    'cancel_job',
    'unblock_job',
  ],
  'buildkite-mcp-write-annotations': ['create_annotation'],
};

const readTools = Object.values(READ_GROUPS).flat();
const writeTools = Object.values(WRITE_GROUPS).flat();
const fineGrainedGroups = { ...READ_GROUPS, ...WRITE_GROUPS };

describe('builtin schemas: buildkite-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('buildkite-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('buildkite-mcp-api', makeRequest({ domain: 'api.buildkite.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('buildkite-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('buildkite-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('buildkite-mcp-session', toolRequest('list_builds'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of readTools) {
      expect(matches('buildkite-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('buildkite-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of writeTools) {
      expect(matches('buildkite-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('buildkite-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('buildkite-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('buildkite-mcp-write-all', rpcRequest('initialize'))).toBe(true);
  });

  it('permissions also match the read-only and single-toolset endpoint variants', () => {
    expect(matches('buildkite-mcp-read-all', toolRequest('list_builds', '/mcp/readonly'))).toBe(
      true
    );
    expect(matches('buildkite-mcp-read-builds', toolRequest('list_builds', '/mcp/x/builds'))).toBe(
      true
    );
    expect(
      matches('buildkite-mcp-write-builds', toolRequest('retry_job', '/mcp/x/retries/readonly'))
    ).toBe(true);
    expect(
      matches('buildkite-mcp-session', mcpRequest(DOMAIN, '/mcp/x/user', mcpRpc('initialize')))
    ).toBe(true);
    expect(matches('buildkite-mcp-read-all', toolRequest('list_builds', '/direct'))).toBe(false);
    expect(matches('buildkite-mcp-read-all', toolRequest('list_builds', '/mcp/other'))).toBe(false);
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    const allTools = [...readTools, ...writeTools];
    for (const [schemaName, tools] of Object.entries(fineGrainedGroups)) {
      for (const tool of allTools) {
        expect(matches(schemaName, toolRequest(tool)), `${schemaName} / ${tool}`).toBe(
          tools.includes(tool)
        );
      }
      expect(matches(schemaName, rpcRequest('initialize')), schemaName).toBe(false);
      for (const tool of tools) {
        expect(matches(schemaName, toolRequest(tool, '/v1/other')), `${schemaName} / ${tool}`).toBe(
          false
        );
      }
    }
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('buildkite-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches(
        'buildkite-mcp-read-builds',
        makeRequest({ domain: DOMAIN, method: 'POST', path: PATH })
      )
    ).toBe(false);
  });
});
