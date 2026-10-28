import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.neon.tech';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const FINE_GRAINED_READ: Record<string, string[]> = {
  'neon-mcp-read-projects': [
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
  ],
  'neon-mcp-read-branches': ['list_branches', 'get_branch', 'get_default_branch'],
  'neon-mcp-read-schema': [
    'describe_branch',
    'get_database_tables',
    'describe_table_schema',
    'compare_database_schema',
  ],
  'neon-mcp-read-performance': ['explain_sql_statement', 'list_slow_queries', 'inspect_database'],
  'neon-mcp-read-databases': [
    'list_postgres_databases',
    'get_postgres_database',
    'list_postgres_roles',
    'get_postgres_role',
  ],
  'neon-mcp-read-credentials': ['list_credentials'],
  'neon-mcp-read-computes': [
    'list_postgres_endpoints',
    'list_branch_computes',
    'get_postgres_endpoint',
  ],
  'neon-mcp-read-snapshots': ['list_snapshots', 'get_snapshot_schedule'],
  'neon-mcp-read-auth': ['get_auth', 'get_neon_auth_config', 'list_auth_trusted_domains'],
  'neon-mcp-read-data-api': ['get_data_api'],
  'neon-mcp-read-observability': [
    'query_logs',
    'list_log_fields',
    'list_log_field_values',
    'get_ai_gateway',
  ],
  'neon-mcp-read-docs': ['search_docs', 'get_doc'],
  'neon-mcp-read-functions': [
    'list_functions',
    'get_function',
    'list_functions_custom_domains',
    'list_triggers',
    'get_trigger',
  ],
  'neon-mcp-read-storage': ['get_storage', 'list_storage_buckets', 'list_storage_objects'],
  'neon-mcp-read-realtime': ['get_realtime'],
};

const FINE_GRAINED_WRITE: Record<string, string[]> = {
  'neon-mcp-write-projects': ['create_project', 'update_project', 'recover_project'],
  'neon-mcp-delete-projects': ['delete_project'],
  'neon-mcp-write-branches': [
    'create_branch',
    'update_branch',
    'set_default_branch',
    'finalize_branch_restore',
  ],
  'neon-mcp-delete-branches': ['delete_branch', 'reset_from_parent'],
  'neon-mcp-run-sql': ['run_sql', 'run_sql_transaction'],
  'neon-mcp-run-migrations': [
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
  'neon-mcp-get-connection-strings': ['get_connection_string'],
  'neon-mcp-write-credentials': ['create_credential', 'rotate_credential', 'revoke_credential'],
  'neon-mcp-write-computes': [
    'create_postgres_endpoint',
    'update_postgres_endpoint',
    'delete_postgres_endpoint',
    'start_postgres_endpoint',
    'suspend_postgres_endpoint',
    'restart_postgres_endpoint',
  ],
  'neon-mcp-write-snapshots': [
    'create_snapshot',
    'update_snapshot',
    'delete_snapshot',
    'set_snapshot_schedule',
    'restore_snapshot',
  ],
  'neon-mcp-write-auth': [
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
  ],
  'neon-mcp-write-data-api': ['provision_neon_data_api', 'update_data_api', 'delete_data_api'],
  'neon-mcp-write-functions': [
    'deploy_function',
    'update_function',
    'delete_function',
    'register_functions_custom_domain',
    'delete_functions_custom_domain',
    'create_trigger',
    'update_trigger',
    'delete_trigger',
  ],
  'neon-mcp-write-storage': [
    'create_storage_bucket',
    'delete_storage_bucket',
    'delete_storage_object',
    'delete_storage_objects_by_prefix',
    'presign_storage_object',
  ],
  'neon-mcp-write-realtime': [
    'enable_realtime',
    'disable_realtime',
    'get_realtime_secret',
    'rotate_realtime_secret',
  ],
  'neon-mcp-send-feedback': ['send_feedback'],
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
