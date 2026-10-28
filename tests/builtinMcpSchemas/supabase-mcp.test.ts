import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.supabase.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'list_tables',
  'list_extensions',
  'list_migrations',
  'get_logs',
  'query_logs',
  'get_advisors',
  'get_project_url',
  'get_publishable_keys',
  'get_anon_key',
  'generate_typescript_types',
  'list_edge_functions',
  'get_edge_function',
  'list_organizations',
  'get_organization',
  'list_projects',
  'get_project',
  'get_cost',
  'confirm_cost',
  'search_docs',
  'list_branches',
  'list_storage_buckets',
  'get_storage_config',
  'list_notebooks',
  'get_notebook',
];

const WRITE_TOOLS = [
  'execute_sql',
  'apply_migration',
  'deploy_edge_function',
  'create_edge_function_secret',
  'create_project',
  'pause_project',
  'restore_project',
  'create_branch',
  'merge_branch',
  'rebase_branch',
  'delete_branch',
  'reset_branch',
  'update_storage_config',
  'create_notebook',
  'run_notebook',
  'submit_feedback',
  'delete_feedback',
];

const FINE_GRAINED: Record<string, string[]> = {
  'supabase-mcp-read-database': ['list_tables', 'list_migrations'],
  'supabase-mcp-execute-sql': ['execute_sql'],
  'supabase-mcp-write-database': ['apply_migration'],
  'supabase-mcp-read-logs': ['get_logs', 'query_logs', 'get_advisors'],
  'supabase-mcp-read-development': ['get_project_url', 'get_publishable_keys', 'get_anon_key'],
  'supabase-mcp-read-edge-functions': ['list_edge_functions', 'get_edge_function'],
  'supabase-mcp-write-edge-functions': ['deploy_edge_function', 'create_edge_function_secret'],
  'supabase-mcp-read-projects': ['list_projects', 'get_organization', 'confirm_cost'],
  'supabase-mcp-write-projects': ['create_project', 'pause_project', 'restore_project'],
  'supabase-mcp-read-docs': ['search_docs'],
  'supabase-mcp-read-branches': ['list_branches'],
  'supabase-mcp-write-branches': ['create_branch', 'merge_branch', 'rebase_branch'],
  'supabase-mcp-delete-branches': ['delete_branch', 'reset_branch'],
  'supabase-mcp-read-storage': ['list_storage_buckets', 'get_storage_config'],
  'supabase-mcp-write-storage': ['update_storage_config'],
  'supabase-mcp-read-notebooks': ['list_notebooks', 'get_notebook'],
  'supabase-mcp-write-notebooks': ['create_notebook', 'run_notebook'],
  'supabase-mcp-send-feedback': ['submit_feedback', 'delete_feedback'],
};

describe('builtin schemas: supabase-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('supabase-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('supabase-mcp-api', makeRequest({ domain: 'api.supabase.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('supabase-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('supabase-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('supabase-mcp-session', toolRequest('list_tables'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('supabase-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('supabase-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('supabase-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('supabase-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('supabase-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('supabase-mcp-write-all', rpcRequest('initialize'))).toBe(true);
  });

  it('execute_sql is only granted by its own schema and write-all', () => {
    expect(matches('supabase-mcp-execute-sql', toolRequest('execute_sql'))).toBe(true);
    expect(matches('supabase-mcp-write-database', toolRequest('execute_sql'))).toBe(false);
    expect(matches('supabase-mcp-read-database', toolRequest('execute_sql'))).toBe(false);
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    const allTools = [...READ_TOOLS, ...WRITE_TOOLS];
    for (const [schema, tools] of Object.entries(FINE_GRAINED)) {
      for (const tool of tools) {
        expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(true);
      }
      const otherSchemaTools = Object.entries(FINE_GRAINED)
        .filter(([otherSchema]) => otherSchema !== schema)
        .flatMap(([, otherTools]) => otherTools);
      for (const tool of otherSchemaTools) {
        expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(false);
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
      for (const tool of tools) {
        expect(matches(schema, mcpRequest(DOMAIN, '/v1/other', mcpToolCall(tool))), schema).toBe(
          false
        );
      }
    }
    expect(matches('supabase-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('supabase-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
    expect(allTools).toHaveLength(new Set(allTools).size);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('supabase-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches(
        'supabase-mcp-execute-sql',
        makeRequest({ domain: DOMAIN, method: 'POST', path: PATH })
      )
    ).toBe(false);
  });
});
