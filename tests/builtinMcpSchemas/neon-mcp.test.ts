import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.neon.tech';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const FINE_GRAINED_READ: Record<string, string[]> = {
  'neon-mcp-read-projects-and-branches': [
    'list_organizations',
    'list_projects',
    'describe_project',
    'list_project_permissions',
    'list_project_members',
    'list_regions',
    'list_operations',
    'get_operation',
    'search',
    'fetch',
    'list_branches',
    'get_branch',
    'get_default_branch',
  ],
  'neon-mcp-read-databases': [
    'list_postgres_databases',
    'get_postgres_database',
    'list_postgres_roles',
    'get_postgres_role',
    'describe_branch',
    'get_database_tables',
    'describe_table_schema',
    'compare_database_schema',
    'explain_sql_statement',
    'list_slow_queries',
    'inspect_database',
  ],
  'neon-mcp-read-auth-and-credentials': [
    'get_auth',
    'get_neon_auth_config',
    'list_auth_trusted_domains',
    'list_credentials',
  ],
  'neon-mcp-read-computes-and-snapshots': [
    'list_postgres_endpoints',
    'list_branch_computes',
    'get_postgres_endpoint',
    'list_snapshots',
    'get_snapshot_schedule',
  ],
  'neon-mcp-read-platform-add-ons': [
    'get_data_api',
    'list_functions',
    'get_function',
    'list_functions_custom_domains',
    'list_triggers',
    'get_trigger',
    'get_storage',
    'list_storage_buckets',
    'list_storage_objects',
    'get_realtime',
    'get_ai_gateway',
  ],
  'neon-mcp-read-logs-and-docs': [
    'query_logs',
    'list_log_fields',
    'list_log_field_values',
    'search_docs',
    'get_doc',
  ],
};

const FINE_GRAINED_WRITE: Record<string, string[]> = {
  'neon-mcp-write-projects-and-branches': [
    'create_project',
    'update_project',
    'recover_project',
    'create_branch',
    'update_branch',
    'set_default_branch',
    'finalize_branch_restore',
    'send_feedback',
  ],
  'neon-mcp-delete-projects-and-branches': ['delete_project', 'delete_branch', 'reset_from_parent'],
  'neon-mcp-run-sql': [
    'run_sql',
    'run_sql_transaction',
    'prepare_database_migration',
    'complete_database_migration',
    'prepare_query_tuning',
    'complete_query_tuning',
  ],
  'neon-mcp-write-databases': [
    'create_postgres_database',
    'update_postgres_database',
    'create_postgres_role',
    'reset_postgres_role_password',
  ],
  'neon-mcp-delete-databases': ['delete_postgres_database', 'delete_postgres_role'],
  'neon-mcp-write-auth-and-credentials': [
    'provision_neon_auth',
    'update_auth_config',
    'disable_auth',
    'list_auth_oauth_providers',
    'add_auth_oauth_provider',
    'update_auth_oauth_provider',
    'delete_auth_oauth_provider',
    'add_auth_trusted_domain',
    'delete_auth_trusted_domain',
    'create_auth_user',
    'update_auth_user_role',
    'delete_auth_user',
    'create_credential',
    'rotate_credential',
    'revoke_credential',
  ],
  'neon-mcp-get-connection-strings': ['get_connection_string'],
  'neon-mcp-write-computes-and-snapshots': [
    'create_postgres_endpoint',
    'update_postgres_endpoint',
    'delete_postgres_endpoint',
    'start_postgres_endpoint',
    'suspend_postgres_endpoint',
    'restart_postgres_endpoint',
    'create_snapshot',
    'update_snapshot',
    'delete_snapshot',
    'set_snapshot_schedule',
    'restore_snapshot',
  ],
  'neon-mcp-write-platform-add-ons': [
    'provision_neon_data_api',
    'update_data_api',
    'delete_data_api',
    'deploy_function',
    'update_function',
    'delete_function',
    'register_functions_custom_domain',
    'delete_functions_custom_domain',
    'create_trigger',
    'update_trigger',
    'delete_trigger',
    'create_storage_bucket',
    'delete_storage_bucket',
    'delete_storage_object',
    'delete_storage_objects_by_prefix',
    'presign_storage_object',
    'enable_realtime',
    'disable_realtime',
    'get_realtime_secret',
    'rotate_realtime_secret',
  ],
};

const READ_TOOLS = Object.values(FINE_GRAINED_READ).flat();
const WRITE_TOOLS = Object.values(FINE_GRAINED_WRITE).flat();
const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];

describe('builtin schemas: neon-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('neon-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('neon-mcp-api', makeRequest({ domain: 'console.neon.tech' }))).toBe(false);
    expect(matches('neon-mcp-api', makeRequest({ domain: 'neon.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('neon-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('neon-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('neon-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('neon-mcp-session', toolRequest('list_projects'))).toBe(false);
    expect(matches('neon-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('covers all 119 tools exactly once', () => {
    expect(ALL_TOOLS).toHaveLength(119);
    expect(new Set(ALL_TOOLS).size).toBe(ALL_TOOLS.length);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('neon-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('neon-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('neon-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('neon-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('neon-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('neon-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('neon-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('neon-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
  });

  it('fine-grained schemas match exactly their tools and nothing else', () => {
    const fineGrained = { ...FINE_GRAINED_READ, ...FINE_GRAINED_WRITE };
    for (const [schema, tools] of Object.entries(fineGrained)) {
      for (const tool of ALL_TOOLS) {
        expect(matches(schema, toolRequest(tool)), `${schema} / ${tool}`).toBe(
          tools.includes(tool)
        );
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
      for (const tool of tools) {
        expect(matches(schema, mcpRequest(DOMAIN, '/sse', mcpToolCall(tool))), schema).toBe(false);
        expect(
          matches(
            schema,
            makeRequest({ domain: DOMAIN, path: PATH, parsedBody: mcpToolCall(tool) })
          ),
          `${schema} with GET`
        ).toBe(false);
      }
    }
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('neon-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches('neon-mcp-run-sql', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
