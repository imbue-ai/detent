import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.webflow.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'data_aeo_tool',
  'data_analyze_tool',
  'data_optimize_tool',
  'element_snapshot_tool',
  'get_asset_preview',
  'ask_webflow_ai',
  'webflow_guide_tool',
  'get_more_tools',
];

const WRITE_TOOLS = [
  'data_sites_tool',
  'data_pages_tool',
  'data_sitemap_tool',
  'data_cms_tool',
  'data_element_tool',
  'data_element_settings_tool',
  'data_element_builder',
  'data_whtml_builder',
  'data_component_tool',
  'data_component_props_tool',
  'data_component_variants_tool',
  'data_component_builder',
  'data_style_tool',
  'data_variable_tool',
  'data_interactions_tool',
  'data_assets_tool',
  'data_fonts_tool',
  'asset_tool',
  'data_forms_tool',
  'data_comments_tool',
  'data_localization_tool',
  'data_scripts_tool',
  'data_enterprise_tool',
  'data_members_tool',
  'data_webhook_tool',
  'data_apps_tool',
  'data_campaigns_tool',
  'data_agent_instructions_tool',
  'designer_tool',
];

const FINE_GRAINED: Record<string, string[]> = {
  'webflow-mcp-read-analytics': ['data_aeo_tool', 'data_analyze_tool', 'data_optimize_tool'],
  'webflow-mcp-read-guidance': ['ask_webflow_ai', 'webflow_guide_tool', 'get_more_tools'],
  'webflow-mcp-read-previews': ['get_asset_preview', 'element_snapshot_tool'],
  'webflow-mcp-write-sites': ['data_sites_tool'],
  'webflow-mcp-write-pages': ['data_pages_tool', 'data_sitemap_tool'],
  'webflow-mcp-write-cms': ['data_cms_tool'],
  'webflow-mcp-write-elements': [
    'data_element_tool',
    'data_element_settings_tool',
    'data_element_builder',
    'data_whtml_builder',
  ],
  'webflow-mcp-write-components': [
    'data_component_tool',
    'data_component_props_tool',
    'data_component_variants_tool',
    'data_component_builder',
  ],
  'webflow-mcp-write-styles': ['data_style_tool', 'data_variable_tool', 'data_interactions_tool'],
  'webflow-mcp-write-assets': ['data_assets_tool', 'data_fonts_tool', 'asset_tool'],
  'webflow-mcp-write-forms': ['data_forms_tool'],
  'webflow-mcp-write-comments': ['data_comments_tool'],
  'webflow-mcp-write-localization': ['data_localization_tool'],
  'webflow-mcp-write-custom-code': ['data_scripts_tool'],
  'webflow-mcp-write-admin': ['data_enterprise_tool', 'data_members_tool', 'data_webhook_tool'],
  'webflow-mcp-write-cloud-apps': ['data_apps_tool'],
  'webflow-mcp-write-campaigns': ['data_campaigns_tool'],
  'webflow-mcp-write-agent-instructions': ['data_agent_instructions_tool'],
  'webflow-mcp-write-designer-session': ['designer_tool'],
};

describe('builtin schemas: webflow-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('webflow-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('webflow-mcp-api', makeRequest({ domain: 'api.webflow.com' }))).toBe(false);
    expect(matches('webflow-mcp-api', makeRequest({ domain: 'webflow.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('webflow-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('webflow-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('webflow-mcp-session', rpcRequest('ping'))).toBe(true);
    expect(matches('webflow-mcp-session', toolRequest('data_analyze_tool'))).toBe(false);
    expect(matches('webflow-mcp-session', toolRequest('data_cms_tool'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('webflow-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('webflow-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('webflow-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('webflow-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('webflow-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('webflow-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('webflow-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('webflow-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
  });

  it('fine-grained schemas cover every tool exactly once', () => {
    const covered = Object.values(FINE_GRAINED).flat();
    expect([...covered].sort()).toEqual([...READ_TOOLS, ...WRITE_TOOLS].sort());
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    for (const [schema, tools] of Object.entries(FINE_GRAINED)) {
      for (const tool of tools) {
        expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(true);
      }
      for (const tool of [...READ_TOOLS, ...WRITE_TOOLS]) {
        if (!tools.includes(tool)) {
          expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(false);
        }
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
      for (const tool of tools) {
        const wrongPath = mcpRequest(DOMAIN, '/beta/mcp', mcpToolCall(tool));
        expect(matches(schema, wrongPath), `${schema} ${tool}`).toBe(false);
      }
    }
  });

  it('permission schemas accept the endpoint path with a trailing slash', () => {
    expect(matches('webflow-mcp-session', mcpRequest(DOMAIN, '/mcp/', mcpRpc('initialize')))).toBe(
      true
    );
    expect(
      matches('webflow-mcp-write-cms', mcpRequest(DOMAIN, '/mcp/', mcpToolCall('data_cms_tool')))
    ).toBe(true);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    const noBody = makeRequest({ domain: DOMAIN, method: 'POST', path: PATH });
    expect(matches('webflow-mcp-session', noBody)).toBe(false);
    expect(matches('webflow-mcp-read-all', noBody)).toBe(false);
    expect(matches('webflow-mcp-write-all', noBody)).toBe(false);
    expect(matches('webflow-mcp-write-cms', noBody)).toBe(false);
  });
});
