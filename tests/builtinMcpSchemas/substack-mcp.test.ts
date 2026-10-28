import { describe, it, expect } from 'vitest';
import {
  builtinRegistry,
  matches,
  mcpRequest,
  mcpRpc,
  mcpToolCall,
  makeRequest,
} from './helpers.js';

const DOMAIN = 'mcp.substack.com';
const PATH = '/api/v1/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

// Substack does not publicly document the tool catalog of its hosted MCP server, so the
// read-all / write-all schemas are based on tool-name conventions. These names are plausible
// examples of each naming style, not confirmed tool names.
const READ_STYLE_TOOLS = [
  'get_publication_stats',
  'get-subscriber-counts',
  'getRevenue',
  'list_posts',
  'search_posts',
  'fetch_retention',
  'query_traffic_sources',
  'describe_publication',
  'view',
  'count',
];

const OTHER_STYLE_TOOLS = [
  'publish_post',
  'send_note',
  'update_settings',
  'export_subscribers',
  'getaway_stats',
  'listing',
  'subscriber_overview',
  'retention',
];

describe('builtin schemas: substack-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('substack-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('substack-mcp-api', makeRequest({ domain: 'substack.com' }))).toBe(false);
    expect(matches('substack-mcp-api', makeRequest({ domain: 'publisher-api.substack.com' }))).toBe(
      false
    );
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('substack-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('substack-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('substack-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('substack-mcp-session', rpcRequest('ping'))).toBe(true);
    expect(matches('substack-mcp-session', toolRequest('get_publication_stats'))).toBe(false);
    expect(matches('substack-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('read-all and write-all partition tool names by their leading verb', () => {
    for (const tool of READ_STYLE_TOOLS) {
      expect(matches('substack-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('substack-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of OTHER_STYLE_TOOLS) {
      expect(matches('substack-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('substack-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('substack-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('substack-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('substack-mcp-read-all', rpcRequest('tools/list'))).toBe(true);
    expect(matches('substack-mcp-write-all', rpcRequest('tools/list'))).toBe(true);
  });

  it('has no fine-grained schemas because the tool catalog is not public', () => {
    const substackSchemaNames = Object.keys(builtinRegistry.allSchemas()).filter((name) =>
      name.startsWith('substack-mcp-')
    );
    expect(substackSchemaNames.sort()).toEqual([
      'substack-mcp-api',
      'substack-mcp-read-all',
      'substack-mcp-session',
      'substack-mcp-write-all',
    ]);
  });

  it('permission schemas pin the endpoint path and POST method', () => {
    const wrongPath = mcpRequest(DOMAIN, '/mcp', mcpToolCall('get_publication_stats'));
    expect(matches('substack-mcp-read-all', wrongPath)).toBe(false);
    expect(matches('substack-mcp-session', mcpRequest(DOMAIN, '/mcp', mcpRpc('initialize')))).toBe(
      false
    );
    const trailingSlash = mcpRequest(DOMAIN, `${PATH}/`, mcpToolCall('get_publication_stats'));
    expect(matches('substack-mcp-read-all', trailingSlash)).toBe(true);
    const viaGet = makeRequest({
      domain: DOMAIN,
      path: PATH,
      parsedBody: mcpToolCall('get_publication_stats'),
    });
    expect(matches('substack-mcp-read-all', viaGet)).toBe(false);
  });

  it('schemas reject requests without a parsed JSON body or a tool name', () => {
    const noBody = makeRequest({ domain: DOMAIN, method: 'POST', path: PATH });
    expect(matches('substack-mcp-read-all', noBody)).toBe(false);
    expect(matches('substack-mcp-write-all', noBody)).toBe(false);
    expect(matches('substack-mcp-session', noBody)).toBe(false);
    const unnamedCall = mcpRequest(DOMAIN, PATH, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { arguments: {} },
    });
    expect(matches('substack-mcp-read-all', unnamedCall)).toBe(false);
    expect(matches('substack-mcp-write-all', unnamedCall)).toBe(false);
  });
});
