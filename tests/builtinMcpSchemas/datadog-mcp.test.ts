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

// Each fine-grained schema with representative tools from every product area it covers.
const FINE_GRAINED: Record<string, string[]> = {
  'datadog-mcp-read-telemetry': [
    'search_datadog_logs',
    'get_logs',
    'build_audit_trail_query',
    'get_datadog_log_archive',
    'validate_observability_pipeline',
    'get_metric_cardinality_profile',
    'aggregate_spans',
    'search_datadog_services',
    'get_profiling_services',
    'get_datadog_debugger_snapshot',
    'get_datadog_k8s_manifest',
    'search_datadog_database_samples',
    'cost_recommendations',
    'ddsql_run_query',
    'ddsql_read_saved_query',
  ],
  'datadog-mcp-write-telemetry-configuration': [
    'delete_datadog_log_pipeline',
    'create_observability_pipeline',
    'manage_metric_tag_configuration',
    'update_apm_sampling_rule',
    'create_debugger_session',
    'create_reference_table',
    'upsert_reference_table_rows',
    'ddsql_upsert_saved_query',
  ],
  'datadog-mcp-read-user-experience': [
    'search_replays',
    'run_product_analytics_journey',
    'get_datadog_error_tracking_analytics',
  ],
  'datadog-mcp-write-user-experience': [
    'upsert_rum_metric',
    'delete_rum_retention_filter',
    'manage_datadog_error_tracking_issue_comments',
  ],
  'datadog-mcp-read-monitoring-and-incidents': [
    'get_monitor_coverage',
    'validate_datadog_monitor',
    'search_datadog_slos',
    'search_watchdog_stories',
    'get_bits_ai_investigation',
    'update_jump_state',
    'list_datadog_case_projects',
    'search_datadog_users',
  ],
  'datadog-mcp-write-monitoring-and-incidents': [
    'create_datadog_monitor',
    'trigger_bits_ai_investigation',
    'link_jira_issue_to_datadog_case',
  ],
  'datadog-mcp-read-dashboards': ['search_datadog_notebooks', 'get_datadog_spreadsheet_tab_data'],
  'datadog-mcp-write-dashboards': [
    'upsert_datadog_spreadsheet',
    'recover_datadog_notebook',
    'delete_datadog_dashboard',
  ],
  'datadog-mcp-read-security-and-governance': [
    'get_datadog_security_aap_denylist',
    'datadog_secrets_scan',
    'generate_datadog_security_iac_custom_rule',
    'get_tag_rule',
  ],
  'datadog-mcp-write-security-and-governance': [
    'update_datadog_security_signals_triage',
    'publish_datadog_security_iac_custom_rule',
    'update_governance_detection',
    'delete_tag_rule',
  ],
  'datadog-mcp-read-software-delivery': [
    'get_datadog_flaky_tests',
    'get_synthetics_tests',
    'list_datadog_feature_flag_allocations',
    'get_experiment_results',
  ],
  'datadog-mcp-write-software-delivery': [
    'edit_synthetics_tests',
    'create_datadog_feature_flag',
    'conclude_experiment',
  ],
  'datadog-mcp-read-data-and-llm-observability': [
    'get_data_entity_lineage',
    'list_llmobs_datasets',
    'estimate_llmobs_topic_discovery_cost',
  ],
  'datadog-mcp-write-data-and-llm-observability': [
    'update_entity_tags',
    'trigger_llmobs_pattern_run',
    'delete_llmobs_annotations',
  ],
  'datadog-mcp-read-automation': [
    'get_datadog_workflow_step_data',
    'validate_datadog_workflow',
    'list_assistant_conversations',
  ],
  'datadog-mcp-write-automation': [
    'add_datadog_managed_mcp_server_to_bits_agent',
    'publish_datadog_form',
    'delete_datadog_workflow',
  ],
  'datadog-mcp-run-actions-and-code': [
    'execute_datadog_workflow',
    'run_datadog_bits_agent',
    'send_message_to_assistant',
    'run_network_path',
    'datadog_remote_action_restricted_shell_run_command',
    'execute_code',
  ],
  'datadog-mcp-read-reference': [
    'read_datadog_documentation',
    'search_datadog_sdk',
    'kubernetes_onboarding',
    'list_reference_tables',
  ],
};

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

  it('every tool is covered by exactly one fine-grained schema', () => {
    const representedTools = Object.values(FINE_GRAINED).flat();
    for (const tool of [...READ_TOOLS, ...WRITE_TOOLS, ...representedTools]) {
      const matching = Object.keys(FINE_GRAINED).filter((schema) =>
        matches(schema, toolRequest(tool))
      );
      expect(matching, tool).toHaveLength(1);
    }
  });

  it('fine-grained schemas stay on one side of the read/write split', () => {
    for (const [schema, tools] of Object.entries(FINE_GRAINED)) {
      const expectedSide = schema.includes('-read-')
        ? 'datadog-mcp-read-all'
        : 'datadog-mcp-write-all';
      for (const tool of tools) {
        expect(matches(expectedSide, toolRequest(tool)), `${schema} ${tool}`).toBe(true);
      }
    }
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    for (const [schema, tools] of Object.entries(FINE_GRAINED)) {
      for (const tool of tools) {
        expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(true);
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
      expect(matches(schema, toolRequest('unknown_tool')), schema).toBe(false);
      expect(matches(schema, mcpRequest(DOMAIN, '/v1/other', mcpToolCall(tools[0]!))), schema).toBe(
        false
      );
    }
    expect(matches('datadog-mcp-read-telemetry', toolRequest('create_derived_metric'))).toBe(false);
    expect(
      matches('datadog-mcp-write-telemetry-configuration', toolRequest('get_metric_tags'))
    ).toBe(false);
    expect(matches('datadog-mcp-read-telemetry', toolRequest('run_network_path'))).toBe(false);
    expect(matches('datadog-mcp-write-automation', toolRequest('execute_datadog_workflow'))).toBe(
      false
    );
    expect(matches('datadog-mcp-run-actions-and-code', toolRequest('search_datadog_sdk'))).toBe(
      false
    );
    expect(matches('datadog-mcp-read-dashboards', toolRequest('ddsql_upsert_saved_query'))).toBe(
      false
    );
  });

  it('permission schemas accept the legacy unstable endpoint path too', () => {
    const legacy = mcpRequest(
      DOMAIN,
      '/api/unstable/mcp-server/mcp',
      mcpToolCall('search_datadog_logs')
    );
    expect(matches('datadog-mcp-read-all', legacy)).toBe(true);
    expect(matches('datadog-mcp-read-telemetry', legacy)).toBe(true);
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
