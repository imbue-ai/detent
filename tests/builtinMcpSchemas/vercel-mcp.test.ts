import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.vercel.com';
const PATH = '/';
const PROJECT_SCOPED_PATH = '/acme-team/my-app';
const CLI_PATH = '/cli/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const FINE_GRAINED_READ: Record<string, string[]> = {
  'vercel-mcp-read-account': [
    'get_auth_user',
    'get_team',
    'list_teams',
    'list_team_members',
    'list_event_types',
    'list_user_events',
    'list_access_groups',
    'read_access_group',
    'read_access_group_project',
    'list_access_group_members',
    'list_access_group_projects',
    'list_billing_charges',
    'list_contract_commitments',
    'search_vercel_documentation',
    'use_vercel_cli',
  ],
  'vercel-mcp-read-projects-and-deployments': [
    'list_projects',
    'get_project',
    'get_project_deployment_protection',
    'get_project_domain',
    'list_project_domains',
    'get_project_deletion_link',
    'git_namespaces',
    'search_repo',
    'get_git_deployment_context',
    'get_microfrontends_config',
    'get_microfrontends_config_for_project',
    'list_deployments',
    'get_deployment',
    'get_deployment_build_logs',
    'get_deployment_feature_flags',
    'get_deployment_file_contents',
    'list_deployment_events',
    'list_deployment_files',
    'open_deployments',
    'ui_get_build_log_excerpt',
    'web_fetch_vercel_url',
    'get_rolling_release',
    'get_rolling_release_config',
    'get_rolling_release_billing_status',
    'list_promote_aliases',
    'list_vercel_ci_invocations',
    'get_vercel_ci_invocation',
    'list_vercel_ci_invocation_attempts',
    'get_vercel_ci_invocation_tree',
    'get_vercel_ci_invocation_logs',
    'list_vercel_ci_job_definitions',
    'get_vercel_ci_job_definition',
    'list_vercel_ci_job_runs',
    'get_vercel_ci_job_run',
    'get_vercel_ci_job_run_logs',
    'list_vercel_ci_task_definitions',
    'list_vercel_ci_task_runs',
    'get_vercel_ci_task_logs',
    'get_vercel_ci_task_run_logs',
    'list_agent_run_projects',
    'list_agent_runs',
    'get_agent_run',
    'get_agent_run_trace',
  ],
  'vercel-mcp-read-domains-and-routing': [
    'list_domains',
    'get_domain',
    'get_domain_config',
    'get_domain_contact_verification',
    'get_domain_project_domains',
    'get_domain_verification_record',
    'get_records',
    'get_domains_records_by_record_id',
    'list_certs',
    'get_cert_by_id',
    'get_order',
    'get_domain_order',
    'get_contact_info_schema',
    'check_domain_availability_and_price',
    'search_domains',
    'get_domain_availability',
    'get_bulk_availability',
    'get_domain_price',
    'get_bulk_price',
    'get_tld',
    'get_tld_price',
    'list_supported_tlds',
    'get_purchase_quote',
    'list_project_routes',
    'list_project_route_versions',
    'list_bulk_redirects',
    'list_bulk_redirect_versions',
    'generate_route',
    'list_aliases',
    'get_alias',
    'list_deployment_aliases',
    'get_firewall_config',
    'get_bypass_ip',
    'get_active_attack_status',
  ],
  'vercel-mcp-read-configuration': [
    'filter_project_envs',
    'get_project_env',
    'get_shared_env_var',
    'get_custom_environment',
    'list_project_custom_environments',
    'list_flags',
    'list_flags_v2',
    'list_team_flags',
    'list_team_flags_v2',
    'get_flag',
    'list_flag_versions',
    'get_flag_segment',
    'list_flag_segments',
    'get_flag_settings',
    'list_team_flag_settings',
    'list_feature_flag_sdk_keys',
    'get_edge_configs',
    'get_edge_config',
    'get_edge_config_items',
    'get_edge_config_item',
    'get_edge_config_tokens',
    'get_edge_config_token',
    'get_edge_config_backups',
    'get_edge_config_backup',
    'list_integration_configurations',
    'get_configuration',
    'list_integration_configuration_products',
    'list_integration_billing_plans',
    'get_webhooks',
    'list_connectors',
    'get_connector',
    'get_connector_project_connection',
    'list_connector_project_connections',
    'list_project_connector_connections',
    'list_kms_issuers',
    'get_kms_issuer',
  ],
  'vercel-mcp-read-observability-and-analytics': [
    'get_runtime_logs',
    'get_runtime_errors',
    'get_project_trace',
    'create_observability_query',
    'get_observability_schema',
    'get_observability_configuration_projects',
    'get_drain',
    'list_drains',
    'get_web_analytics',
    'count_pageviews',
    'count_events',
    'aggregate_pageviews',
    'aggregate_events',
  ],
  'vercel-mcp-read-storage-and-sandboxes': [
    'get_storage_stores_by_id',
    'artifact_query',
    'get_remote_cache_status',
    'list_named_sandboxes',
    'get_named_sandbox',
    'list_sessions',
    'get_session',
    'list_session_commands',
    'get_session_command',
    'get_session_command_logs',
    'list_session_snapshots',
    'get_session_snapshot',
    'read_session_file',
  ],
  'vercel-mcp-read-toolbar': ['list_toolbar_threads', 'get_toolbar_thread'],
};

const FINE_GRAINED_WRITE: Record<string, string[]> = {
  'vercel-mcp-send-feedback': ['submit_feedback'],
  'vercel-mcp-write-projects-and-deployments': [
    'create_project',
    'create_git_project',
    'update_project',
    'pause_project',
    'unpause_project',
    'accept_project_transfer_request',
    'add_project_domain',
    'verify_project_domain',
    'update_project_deployment_protection',
    'update_project_protection_bypass',
    'create_deployment',
    'deploy_to_vercel',
    'import-claude-design-from-url',
    'upload_file',
    'cancel_deployment',
    'get_access_to_vercel_url',
    'rerequest_check',
    'request_promote',
    'request_rollback',
    'start_rolling_release',
    'approve_rolling_release_stage',
    'complete_rolling_release',
    'update_rolling_release_config',
    'retry_vercel_ci_invocation',
  ],
  'vercel-mcp-write-domains-and-routing': [
    'create_or_transfer_domain',
    'create_record',
    'update_record',
    'replace_domain_dns_records',
    'issue_cert',
    'add_route',
    'edit_route',
    'stage_routes',
    'update_route_versions',
    'stage_redirects',
    'restore_redirects',
    'update_bulk_redirect_version',
    'assign_alias',
    'patch_url_protection_bypass',
    'put_firewall_config',
    'update_firewall_config',
    'update_attack_challenge_mode',
  ],
  'vercel-mcp-make-purchases': [
    'buy_domain',
    'buy_domains',
    'buy_single_domain',
    'buy_pro',
    'buy_credits',
    'buy_addon',
  ],
  'vercel-mcp-write-configuration': [
    'create_project_env',
    'edit_project_env',
    'create_flag',
    'update_flag',
    'update_flag_segment',
    'update_flag_settings',
    'create_sdk_key',
    'create_edge_config',
    'update_edge_config',
    'patch_edge_config_items',
    'create_edge_config_token',
    'restore_edge_config_backup',
    'update_connector',
    'upsert_connector_project_connection',
    'create_kms_issuer',
    'update_kms_issuer',
    'create_kms_issuer_policy',
    'update_kms_issuer_policy',
    'create_kms_signing_key',
    'activate_kms_signing_key',
    'revoke_kms_signing_key',
  ],
  'vercel-mcp-write-observability-and-analytics': [
    'create_drain',
    'update_drain',
    'test_drain',
    'create_trace_session',
  ],
  'vercel-mcp-write-storage-and-sandboxes': [
    'create_storage_stores_blob',
    'upload_artifact',
    'record_events',
    'invalidate_by_tags',
    'invalidate_by_src_images',
    'create_sandboxes_v2',
    'create_sandboxes_v3',
    'create_sandboxes_v4',
    'update_sandbox',
    'run_session_command',
    'kill_session_command',
    'write_session_files',
    'create_session_directory',
    'create_sandboxes_sessions_by_session_id_snapshot_v2',
    'create_sandboxes_sessions_by_session_id_snapshot_v3',
    'extend_session_timeout',
    'update_session_network_policy',
    'stop_session',
  ],
  'vercel-mcp-write-toolbar': [
    'reply_to_toolbar_thread',
    'edit_toolbar_message',
    'add_toolbar_reaction',
    'change_toolbar_thread_resolve_status',
  ],
};

const READ_TOOLS = Object.values(FINE_GRAINED_READ).flat();
const WRITE_TOOLS = Object.values(FINE_GRAINED_WRITE).flat();
const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];

describe('builtin schemas: vercel-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('vercel-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('vercel-mcp-api', makeRequest({ domain: 'api.vercel.com' }))).toBe(false);
    expect(matches('vercel-mcp-api', makeRequest({ domain: 'vercel.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('vercel-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('vercel-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('vercel-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('vercel-mcp-session', toolRequest('list_projects'))).toBe(false);
    expect(matches('vercel-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('covers all 251 tools exactly once', () => {
    expect(ALL_TOOLS).toHaveLength(251);
    expect(new Set(ALL_TOOLS).size).toBe(ALL_TOOLS.length);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('vercel-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('vercel-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('vercel-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('vercel-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('vercel-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('vercel-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('vercel-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('vercel-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
  });

  it('matches the root, project-scoped and CLI endpoint paths but not deeper ones', () => {
    const call = mcpToolCall('list_projects');
    for (const path of [PATH, PROJECT_SCOPED_PATH, `${PROJECT_SCOPED_PATH}/`, CLI_PATH]) {
      expect(matches('vercel-mcp-read-all', mcpRequest(DOMAIN, path, call)), path).toBe(true);
      expect(
        matches('vercel-mcp-read-projects-and-deployments', mcpRequest(DOMAIN, path, call)),
        path
      ).toBe(true);
      expect(matches('vercel-mcp-session', mcpRequest(DOMAIN, path, mcpRpc('ping'))), path).toBe(
        true
      );
    }
    for (const path of ['/acme-team/my-app/extra', '/a/b/c', '/with space']) {
      expect(matches('vercel-mcp-read-all', mcpRequest(DOMAIN, path, call)), path).toBe(false);
      expect(
        matches('vercel-mcp-read-projects-and-deployments', mcpRequest(DOMAIN, path, call)),
        path
      ).toBe(false);
    }
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
        expect(
          matches(schema, mcpRequest(DOMAIN, '/a/b/c', mcpToolCall(tool))),
          `${schema} on a deeper path`
        ).toBe(false);
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
      matches('vercel-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches(
        'vercel-mcp-write-projects-and-deployments',
        makeRequest({ domain: DOMAIN, method: 'POST', path: PATH })
      )
    ).toBe(false);
  });
});
