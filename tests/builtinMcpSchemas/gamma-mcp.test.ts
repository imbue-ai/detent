import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.gamma.app';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'get_generation_status',
  'get_image_generation_status',
  'export_gamma',
  'get_export_status',
  'get_edit_status',
  'get_gammas',
  'search_gammas',
  'search_templates',
  'read_gamma',
  'get_gamma_outline',
  'get_gamma_comments',
  'get_gamma_analytics',
  'get_gamma_card_analytics',
  'get_gamma_viewer_analytics',
  'get_gamma_viewer_detail_analytics',
  'get_themes',
  'get_folders',
  'mention_gammas',
];

const WRITE_TOOLS = [
  'generate',
  'generate_multi_page_gamma',
  'generate_from_template',
  'generate_image',
  'edit_gamma',
];

const FINE_GRAINED: Record<string, string[]> = {
  'gamma-mcp-read-gammas': [
    'get_gammas',
    'search_gammas',
    'read_gamma',
    'get_gamma_outline',
    'get_gamma_comments',
    'mention_gammas',
  ],
  'gamma-mcp-read-workspace': ['search_templates', 'get_themes', 'get_folders'],
  'gamma-mcp-read-analytics': [
    'get_gamma_analytics',
    'get_gamma_card_analytics',
    'get_gamma_viewer_analytics',
    'get_gamma_viewer_detail_analytics',
  ],
  'gamma-mcp-read-job-status': [
    'get_generation_status',
    'get_image_generation_status',
    'get_edit_status',
    'get_export_status',
  ],
  'gamma-mcp-export-gammas': ['export_gamma', 'get_export_status'],
  'gamma-mcp-generate-gammas': ['generate', 'generate_multi_page_gamma', 'generate_from_template'],
  'gamma-mcp-generate-images': ['generate_image'],
  'gamma-mcp-edit-gammas': ['edit_gamma'],
};

describe('builtin schemas: gamma-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('gamma-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('gamma-mcp-api', makeRequest({ domain: 'public-api.gamma.app' }))).toBe(false);
    expect(matches('gamma-mcp-api', makeRequest({ domain: 'gamma.app' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('gamma-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('gamma-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('gamma-mcp-session', rpcRequest('ping'))).toBe(true);
    expect(matches('gamma-mcp-session', rpcRequest('tools/call'))).toBe(false);
    expect(matches('gamma-mcp-session', toolRequest('get_gammas'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('gamma-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('gamma-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('gamma-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('gamma-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('gamma-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('gamma-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('gamma-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('gamma-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
  });

  it('every tool appears in at least one fine-grained schema', () => {
    const covered = new Set(Object.values(FINE_GRAINED).flat());
    for (const tool of [...READ_TOOLS, ...WRITE_TOOLS]) {
      expect(covered.has(tool), tool).toBe(true);
    }
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    const allTools = [...READ_TOOLS, ...WRITE_TOOLS];
    for (const [schema, tools] of Object.entries(FINE_GRAINED)) {
      for (const tool of allTools) {
        expect(matches(schema, toolRequest(tool)), `${schema} / ${tool}`).toBe(
          tools.includes(tool)
        );
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
      for (const tool of tools) {
        const wrongPath = mcpRequest(DOMAIN, '/v1/other', mcpToolCall(tool));
        expect(matches(schema, wrongPath), `${schema} / ${tool}`).toBe(false);
      }
    }
  });

  it('schemas accept a trailing slash on the endpoint path', () => {
    expect(
      matches('gamma-mcp-read-gammas', mcpRequest(DOMAIN, '/mcp/', mcpToolCall('read_gamma')))
    ).toBe(true);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    const noBody = makeRequest({ domain: DOMAIN, method: 'POST', path: PATH });
    expect(matches('gamma-mcp-read-all', noBody)).toBe(false);
    expect(matches('gamma-mcp-write-all', noBody)).toBe(false);
    expect(matches('gamma-mcp-session', noBody)).toBe(false);
    expect(matches('gamma-mcp-generate-gammas', noBody)).toBe(false);
  });
});
