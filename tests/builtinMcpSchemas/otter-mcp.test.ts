import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.otter.ai';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const SEARCH_TOOLS = ['search', 'otter_search'];
const FETCH_TOOLS = ['fetch', 'otter_fetch'];
const ACCOUNT_TOOLS = ['get_user_info', 'otter_get_user_info'];
const ALL_TOOLS = [...SEARCH_TOOLS, ...FETCH_TOOLS, ...ACCOUNT_TOOLS];

const FINE_GRAINED = [
  { schema: 'otter-mcp-search-meetings', tools: SEARCH_TOOLS },
  { schema: 'otter-mcp-read-transcripts', tools: FETCH_TOOLS },
  { schema: 'otter-mcp-read-account', tools: ACCOUNT_TOOLS },
];

describe('builtin schemas: otter-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('otter-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('otter-mcp-api', makeRequest({ domain: 'otter.ai' }))).toBe(false);
    expect(matches('otter-mcp-api', makeRequest({ domain: 'api.otter.ai' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('otter-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('otter-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('otter-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('otter-mcp-session', rpcRequest('tools/call'))).toBe(false);
    expect(matches('otter-mcp-session', toolRequest('search'))).toBe(false);
  });

  it('read-all covers every tool of the read-only server plus the handshake', () => {
    for (const tool of ALL_TOOLS) {
      expect(matches('otter-mcp-read-all', toolRequest(tool)), tool).toBe(true);
    }
    expect(matches('otter-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('otter-mcp-read-all', rpcRequest('ping'))).toBe(true);
    expect(matches('otter-mcp-read-all', toolRequest('delete_meeting'))).toBe(false);
    expect(matches('otter-mcp-read-all', toolRequest('otter_update_meeting'))).toBe(false);
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    for (const { schema, tools } of FINE_GRAINED) {
      for (const tool of ALL_TOOLS) {
        expect(matches(schema, toolRequest(tool)), `${schema} / ${tool}`).toBe(
          tools.includes(tool)
        );
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
    }
  });

  it('permission schemas require the MCP endpoint path and POST', () => {
    const wrongPath = mcpRequest(DOMAIN, '/v1/other', mcpToolCall('search'));
    expect(matches('otter-mcp-read-all', wrongPath)).toBe(false);
    expect(matches('otter-mcp-search-meetings', wrongPath)).toBe(false);
    expect(
      matches('otter-mcp-session', mcpRequest(DOMAIN, '/v1/other', mcpRpc('initialize')))
    ).toBe(false);

    const getRequest = makeRequest({
      domain: DOMAIN,
      method: 'GET',
      path: PATH,
      parsedBody: mcpToolCall('search'),
    });
    expect(matches('otter-mcp-read-all', getRequest)).toBe(false);

    expect(matches('otter-mcp-read-all', mcpRequest(DOMAIN, '/mcp/', mcpToolCall('fetch')))).toBe(
      true
    );
  });

  it('schemas reject requests without a parsed JSON body', () => {
    const bodiless = makeRequest({ domain: DOMAIN, method: 'POST', path: PATH });
    expect(matches('otter-mcp-read-all', bodiless)).toBe(false);
    expect(matches('otter-mcp-session', bodiless)).toBe(false);
    expect(matches('otter-mcp-search-meetings', bodiless)).toBe(false);
  });
});
