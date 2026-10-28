import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.datadoghq.com';
const PATH = '/v1/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'search_datadog_logs',
  'get_logs',
  'analyze_datadog_logs',
  'get_datadog_metric',
  'get_metric_volume',
  'get_datadog_trace',
  'apm_query_trace',
  'search_datadog_services',
  'search_datadog_hosts',
  'describe_datadog_k8s_resource',
  'cost_recommendations',
  'discover_datadog_logpoint',
  'search_audit_events',
  'get_datadog_database_explain_plans',
  'explore_profiling_flame_graph',
  'run_product_analytics_journey',
  'get_replay_summary',
  'validate_datadog_monitor',
  'search_datadog_slos',
  'search_datadog_incidents',
  'get_bits_ai_investigation',
  'find_new_jumps',
  'update_jump_state',
  'get_datadog_case_attachment',
  'search_datadog_users',
  'analyze_datadog_error_tracking_errors',
  'get_datadog_dashboard',
  'visualize_tabular_data',
  'get_datadog_spreadsheet_tab_data',
  'validate_observability_pipeline',
  'datadog_secrets_scan',
  'generate_datadog_security_iac_custom_rule',
  'list_governance_limits',
  'aggregate_dora_deployments',
  'get_synthetics_tests',
  'check_datadog_flag_implementation',
  'get_experiment_results',
  'get_entity_tags',
  'get_llmobs_agent_loop',
  'estimate_llmobs_topic_discovery_cost',
  'ddsql_run_query',
  'ddsql_create_link',
  'get_reference_table_rows',
  'validate_datadog_workflow',
  'list_assistant_conversations',
  'search_datadog_sdk',
  'kubernetes_onboarding',
];

const WRITE_TOOLS = [
  'create_derived_metric',
  'manage_tag_indexing_rule',
  'delete_apm_sampling_rule',
  'reorder_apm_service_remapping_rules',
  'run_network_path',
  'datadog_remote_action_restricted_shell_run_command',
  'enable_live_debugger',
  'delete_rum_retention_filter',
  'create_datadog_monitor',
  'trigger_general_investigation',
  'steer_bits_ai_investigation',
  'add_comment_to_datadog_case',
  'manage_datadog_error_tracking_issue_links',
  'upsert_datadog_dashboard',
  'recover_datadog_notebook',
  'delete_datadog_notebook',
  'move_datadog_log_index',
  'create_observability_pipeline',
  'mute_datadog_security_findings',
  'publish_datadog_security_iac_custom_rule',
  'mitigate_governance_detections',
  'synthetics_test_wizard',
  'update_datadog_flaky_test_states',
  'sync_datadog_feature_flag_allocations',
  'conclude_experiment',
  'update_entity_description',
  'submit_llmobs_agent_insight_feedback',
  'delete_llmobs_annotations',
  'ddsql_upsert_saved_query',
  'append_reference_table_rows',
  'publish_datadog_form',
  'delete_datadog_workflow',
  'execute_datadog_workflow',
  'send_message_to_assistant',
  'execute_code',
];

// [schema suffix, a tool it matches, a tool it does not match]
const FINE_GRAINED: [string, string, string][] = [
  ['read-logs', 'search_datadog_logs', 'search_datadog_spans'],
  ['read-metrics', 'get_metric_cardinality_profile', 'create_derived_metric'],
  ['write-metrics', 'manage_metric_tag_configuration', 'get_metric_tags'],
  ['read-traces', 'aggregate_spans', 'create_apm_sampling_rule'],
  ['write-apm-configuration', 'update_apm_sampling_rule', 'search_apm_sampling_rules'],
  ['read-infrastructure', 'get_datadog_k8s_manifest', 'run_network_path'],
  [
    'run-remote-actions',
    'datadog_remote_action_restricted_shell_run_command',
    'search_datadog_hosts',
  ],
  ['read-live-debugger', 'get_datadog_debugger_snapshot', 'create_datadog_logpoint'],
  ['write-live-debugger', 'create_debugger_session', 'list_datadog_session_logpoints'],
  ['read-events', 'build_audit_trail_query', 'search_datadog_logs'],
  ['read-databases', 'search_datadog_database_samples', 'ddsql_run_query'],
  ['read-profiling', 'get_profiling_services', 'get_datadog_trace'],
  ['read-rum', 'search_replays', 'create_rum_operation'],
  ['write-rum', 'upsert_rum_metric', 'search_rum_metrics'],
  ['read-monitors', 'get_monitor_coverage', 'create_datadog_monitor'],
  ['write-monitors', 'create_datadog_monitor', 'validate_datadog_monitor'],
  ['read-investigations', 'search_watchdog_stories', 'trigger_incident_investigation'],
  ['write-investigations', 'trigger_bits_ai_investigation', 'get_bits_ai_investigation'],
  ['read-cases', 'list_datadog_case_projects', 'create_datadog_case_project'],
  ['write-cases', 'link_jira_issue_to_datadog_case', 'get_datadog_case_links'],
  [
    'read-error-tracking',
    'get_datadog_error_tracking_analytics',
    'update_datadog_error_tracking_issue',
  ],
  [
    'write-error-tracking',
    'manage_datadog_error_tracking_issue_comments',
    'get_datadog_error_tracking_issue',
  ],
  ['read-dashboards', 'search_datadog_notebooks', 'edit_datadog_notebook'],
  ['write-dashboards', 'upsert_datadog_spreadsheet', 'delete_datadog_spreadsheet'],
  ['delete-dashboards', 'delete_datadog_dashboard', 'upsert_datadog_dashboard'],
  ['read-logs-configuration', 'get_datadog_log_archive', 'upsert_datadog_log_archive'],
  ['write-logs-configuration', 'delete_datadog_log_pipeline', 'list_datadog_log_pipelines'],
  ['read-security', 'get_datadog_security_aap_denylist', 'upsert_datadog_security_aap_denylist'],
  ['write-security', 'update_datadog_security_signals_triage', 'search_datadog_security_signals'],
  ['read-governance', 'get_tag_rule', 'delete_tag_rule'],
  ['write-governance', 'update_governance_detection', 'get_governance_detection'],
  ['read-software-delivery', 'get_datadog_flaky_tests', 'update_datadog_flaky_test_states'],
  ['write-software-delivery', 'edit_synthetics_tests', 'get_synthetics_tests'],
  ['read-feature-flags', 'list_datadog_feature_flag_allocations', 'start_experiment'],
  ['write-feature-flags', 'create_datadog_feature_flag', 'get_datadog_feature_flag'],
  ['read-data-observability', 'get_data_entity_lineage', 'update_entity_tags'],
  ['write-data-observability', 'update_entity_tags', 'get_entity_tags'],
  ['read-llm-observability', 'list_llmobs_datasets', 'add_llmobs_dataset_records'],
  ['write-llm-observability', 'trigger_llmobs_pattern_run', 'list_llmobs_pattern_runs'],
  ['run-ddsql-queries', 'ddsql_run_query', 'ddsql_upsert_saved_query'],
  ['write-ddsql-saved-queries', 'ddsql_upsert_saved_query', 'ddsql_read_saved_query'],
  ['read-reference-tables', 'list_reference_tables', 'create_reference_table'],
  ['write-reference-tables', 'upsert_reference_table_rows', 'list_reference_table_rows'],
  ['read-automation', 'get_datadog_workflow_step_data', 'execute_datadog_workflow'],
  ['write-automation', 'add_datadog_managed_mcp_server_to_bits_agent', 'run_datadog_bits_agent'],
  ['delete-automation', 'delete_datadog_workflow', 'unpublish_datadog_workflow'],
  ['run-automation', 'run_datadog_bits_agent', 'delete_datadog_workflow'],
  ['execute-code', 'execute_code', 'search_datadog_sdk'],
  ['read-documentation', 'read_datadog_documentation', 'execute_code'],
];

describe('builtin schemas: datadog-mcp', () => {
  it('scope matches every regional MCP host and nothing else', () => {
    for (const host of [
      'mcp.datadoghq.com',
      'mcp.us3.datadoghq.com',
      'mcp.us5.datadoghq.com',
      'mcp.ap1.datadoghq.com',
      'mcp.ap2.datadoghq.com',
      'mcp.uk1.datadoghq.com',
      'mcp.datadoghq.eu',
    ]) {
      expect(matches('datadog-mcp-api', makeRequest({ domain: host })), host).toBe(true);
    }
    expect(matches('datadog-mcp-api', makeRequest({ domain: 'api.datadoghq.com' }))).toBe(false);
    expect(matches('datadog-mcp-api', makeRequest({ domain: 'app.datadoghq.com' }))).toBe(false);
    expect(matches('datadog-mcp-api', makeRequest({ domain: 'mcp.us2.datadoghq.com' }))).toBe(
      false
    );
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('datadog-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('datadog-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('datadog-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('datadog-mcp-session', toolRequest('search_datadog_logs'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('datadog-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('datadog-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('datadog-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('datadog-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('datadog-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('datadog-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('datadog-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('datadog-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    for (const [suffix, included, excluded] of FINE_GRAINED) {
      const schema = `datadog-mcp-${suffix}`;
      expect(matches(schema, toolRequest(included)), `${schema} ${included}`).toBe(true);
      expect(matches(schema, toolRequest(excluded)), `${schema} ${excluded}`).toBe(false);
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
      expect(matches(schema, mcpRequest(DOMAIN, '/v1/other', mcpToolCall(included))), schema).toBe(
        false
      );
    }
  });

  it('permission schemas accept the legacy unstable endpoint path too', () => {
    const legacy = mcpRequest(
      DOMAIN,
      '/api/unstable/mcp-server/mcp',
      mcpToolCall('search_datadog_logs')
    );
    expect(matches('datadog-mcp-read-all', legacy)).toBe(true);
    expect(matches('datadog-mcp-read-logs', legacy)).toBe(true);
    expect(
      matches(
        'datadog-mcp-session',
        mcpRequest(DOMAIN, '/api/unstable/mcp-server/mcp', mcpRpc('ping'))
      )
    ).toBe(true);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('datadog-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches('datadog-mcp-session', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
