import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.airtable.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'list_workspaces',
  'list_bases',
  'search_bases',
  'list_external_accounts',
  'list_tables_for_base',
  'get_table_schema',
  'list_views_for_table',
  'list_records_for_table',
  'search_records',
  'search_candidate_linked_records',
  'display_records_for_table',
  'list_pages_for_base',
  'list_records_for_page',
  'get_record_for_page',
  'describe_page_type',
  'describe_page_element',
  'get_form_schema',
  'list_automations',
  'get_automation',
  'get_create_automation_instructions',
  'fetch_automation_input_data',
];

const WRITE_TOOLS = [
  'create_base',
  'create_table',
  'update_table',
  'create_field',
  'update_field',
  'delete_table',
  'create_records_for_table',
  'update_records_for_table',
  'revert_action',
  'delete_records_for_table',
  'create_interface',
  'create_page',
  'delete_interface',
  'delete_page',
  'submit_form',
  'create_automation',
  'update_automation',
  'test_automation_webhook_trigger',
  'delete_automation',
];

const FINE_GRAINED: Record<string, string[]> = {
  'airtable-mcp-read-bases': [
    'list_workspaces',
    'list_bases',
    'search_bases',
    'list_external_accounts',
  ],
  'airtable-mcp-write-bases': ['create_base'],
  'airtable-mcp-read-tables': ['list_tables_for_base', 'get_table_schema', 'list_views_for_table'],
  'airtable-mcp-write-tables': ['create_table', 'update_table', 'create_field', 'update_field'],
  'airtable-mcp-delete-tables': ['delete_table'],
  'airtable-mcp-read-records': [
    'list_records_for_table',
    'search_records',
    'search_candidate_linked_records',
    'display_records_for_table',
  ],
  'airtable-mcp-write-records': [
    'create_records_for_table',
    'update_records_for_table',
    'revert_action',
  ],
  'airtable-mcp-delete-records': ['delete_records_for_table'],
  'airtable-mcp-read-interfaces': [
    'list_pages_for_base',
    'list_records_for_page',
    'get_record_for_page',
    'describe_page_type',
    'describe_page_element',
    'get_form_schema',
  ],
  'airtable-mcp-write-interfaces': ['create_interface', 'create_page'],
  'airtable-mcp-delete-interfaces': ['delete_interface', 'delete_page'],
  'airtable-mcp-submit-forms': ['submit_form'],
  'airtable-mcp-read-automations': [
    'list_automations',
    'get_automation',
    'get_create_automation_instructions',
    'fetch_automation_input_data',
  ],
  'airtable-mcp-write-automations': [
    'create_automation',
    'update_automation',
    'test_automation_webhook_trigger',
  ],
  'airtable-mcp-delete-automations': ['delete_automation'],
};

describe('builtin schemas: airtable-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('airtable-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('airtable-mcp-api', makeRequest({ domain: 'api.airtable.com' }))).toBe(false);
    expect(matches('airtable-mcp-api', makeRequest({ domain: 'airtable.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('airtable-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('airtable-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('airtable-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('airtable-mcp-session', toolRequest('list_bases'))).toBe(false);
    expect(matches('airtable-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('airtable-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('airtable-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('airtable-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('airtable-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('airtable-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('airtable-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('airtable-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('airtable-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
  });

  it('fine-grained schemas match exactly their tools and cover every tool', () => {
    const allTools = [...READ_TOOLS, ...WRITE_TOOLS];
    const covered = new Set(Object.values(FINE_GRAINED).flat());
    expect([...covered].sort()).toEqual([...allTools].sort());
    for (const [schema, tools] of Object.entries(FINE_GRAINED)) {
      for (const tool of allTools) {
        expect(matches(schema, toolRequest(tool)), `${schema} / ${tool}`).toBe(
          tools.includes(tool)
        );
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
      for (const tool of tools) {
        expect(matches(schema, mcpRequest(DOMAIN, '/v1/other', mcpToolCall(tool))), schema).toBe(
          false
        );
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
      matches('airtable-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches(
        'airtable-mcp-read-records',
        makeRequest({ domain: DOMAIN, method: 'POST', path: PATH })
      )
    ).toBe(false);
  });
});
