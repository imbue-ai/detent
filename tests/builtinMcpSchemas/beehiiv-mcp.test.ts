import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.beehiiv.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

// The documented v1 tools (all read-only) plus read-style names the pattern must cover.
const READ_TOOLS = [
  'get_workspace',
  'list_publications',
  'get_publication',
  'get_publication_stats',
  'list_posts',
  'get_post',
  'get_post_content',
  'get_post_stats',
  'list_subscriptions',
  'get_subscription',
  'search_posts',
  'list-segments',
  'listAutomations',
  'get',
];

// beehiiv does not publish its write tool catalog; these are representative write-style names.
const WRITE_TOOLS = [
  'create_segment',
  'update_post',
  'create_post',
  'delete_subscription',
  'add_subscriber_tag',
  'upsert_custom_field',
  'getaway_post', // "get" followed by a letter is not a read verb
  'settings',
];

describe('builtin schemas: beehiiv-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('beehiiv-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('beehiiv-mcp-api', makeRequest({ domain: 'api.beehiiv.com' }))).toBe(false);
    expect(matches('beehiiv-mcp-api', makeRequest({ domain: 'app.beehiiv.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('beehiiv-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('beehiiv-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('beehiiv-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('beehiiv-mcp-session', toolRequest('list_posts'))).toBe(false);
    expect(matches('beehiiv-mcp-session', toolRequest('create_segment'))).toBe(false);
  });

  it('read-all and write-all partition the tools by naming convention', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('beehiiv-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('beehiiv-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('beehiiv-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('beehiiv-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('beehiiv-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('beehiiv-mcp-write-all', rpcRequest('initialize'))).toBe(true);
  });

  it('read-all and write-all only match the MCP endpoint path and POST', () => {
    const otherPath = mcpRequest(DOMAIN, '/v1/other', mcpToolCall('list_posts'));
    expect(matches('beehiiv-mcp-read-all', otherPath)).toBe(false);
    const otherPathWrite = mcpRequest(DOMAIN, '/v1/other', mcpToolCall('create_segment'));
    expect(matches('beehiiv-mcp-write-all', otherPathWrite)).toBe(false);
    const getRequest = makeRequest({
      domain: DOMAIN,
      method: 'GET',
      path: PATH,
      parsedBody: mcpToolCall('list_posts'),
    });
    expect(matches('beehiiv-mcp-read-all', getRequest)).toBe(false);
    expect(
      matches(
        'beehiiv-mcp-session',
        makeRequest({ domain: DOMAIN, method: 'GET', path: PATH, parsedBody: mcpRpc('ping') })
      )
    ).toBe(false);
  });

  it('write-all does not match tool calls without a tool name', () => {
    const nameless = mcpRequest(DOMAIN, PATH, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { arguments: {} },
    });
    expect(matches('beehiiv-mcp-write-all', nameless)).toBe(false);
    expect(matches('beehiiv-mcp-read-all', nameless)).toBe(false);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    const noBody = makeRequest({ domain: DOMAIN, method: 'POST', path: PATH });
    expect(matches('beehiiv-mcp-read-all', noBody)).toBe(false);
    expect(matches('beehiiv-mcp-write-all', noBody)).toBe(false);
    expect(matches('beehiiv-mcp-session', noBody)).toBe(false);
  });
});
