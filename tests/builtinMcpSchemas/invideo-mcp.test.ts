import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.invideo.io';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const HANDSHAKE_METHODS = [
  'initialize',
  'notifications/initialized',
  'notifications/cancelled',
  'ping',
  'tools/list',
  'prompts/list',
  'prompts/get',
  'resources/list',
  'resources/read',
  'resources/templates/list',
  'resources/subscribe',
  'resources/unsubscribe',
  'completion/complete',
  'logging/setLevel',
];

// invideo documents only get_help and list_projects; the rest are plausible names used to
// exercise the tool-name convention the read-all / write-all schemas rely on.
const READ_TOOLS = [
  'get_help',
  'list_projects',
  'show_edit',
  'inspect_edit',
  'search_library',
  'check_edit',
  'catalog_operations',
  'probe_asset',
  'getProject',
  'list-branches',
  'get',
];
const WRITE_TOOLS = [
  'create_project',
  'change_edit',
  'upload_asset',
  'add_media',
  'export_edit',
  'run_generation',
  'checkpoint_branch',
  'restore_branch',
  'register_agent',
  'message_agent',
  'rename_project',
  'getaway_car',
  'listen',
];

describe('builtin schemas: invideo-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('invideo-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('invideo-mcp-api', makeRequest({ domain: DOMAIN, path: '/sse' }))).toBe(true);
    expect(matches('invideo-mcp-api', makeRequest({ domain: 'invideo.io' }))).toBe(false);
    expect(matches('invideo-mcp-api', makeRequest({ domain: 'pro-api-auth.invideo.io' }))).toBe(
      false
    );
  });

  it('session matches the handshake but not tool calls', () => {
    for (const method of HANDSHAKE_METHODS) {
      expect(matches('invideo-mcp-session', rpcRequest(method)), method).toBe(true);
    }
    expect(matches('invideo-mcp-session', toolRequest('get_help'))).toBe(false);
    expect(matches('invideo-mcp-session', toolRequest('create_project'))).toBe(false);
    expect(matches('invideo-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('read-all and write-all partition the tools by naming convention', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('invideo-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('invideo-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('invideo-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('invideo-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const method of HANDSHAKE_METHODS) {
      expect(matches('invideo-mcp-read-all', rpcRequest(method)), method).toBe(true);
      expect(matches('invideo-mcp-write-all', rpcRequest(method)), method).toBe(true);
    }
  });

  it('read-all and write-all require the MCP endpoint path and a POST', () => {
    const onOtherPath = mcpRequest(DOMAIN, '/sse', mcpToolCall('get_help'));
    expect(matches('invideo-mcp-read-all', onOtherPath)).toBe(false);
    expect(matches('invideo-mcp-write-all', onOtherPath)).toBe(false);
    expect(matches('invideo-mcp-session', mcpRequest(DOMAIN, '/sse', mcpRpc('initialize')))).toBe(
      false
    );

    const asGet = makeRequest({
      domain: DOMAIN,
      method: 'GET',
      path: PATH,
      parsedBody: mcpToolCall('get_help'),
    });
    expect(matches('invideo-mcp-read-all', asGet)).toBe(false);

    expect(
      matches('invideo-mcp-read-all', mcpRequest(DOMAIN, '/mcp/', mcpToolCall('get_help')))
    ).toBe(true);
  });

  it('tool calls without a tool name match neither read-all nor write-all', () => {
    const nameless = mcpRequest(DOMAIN, PATH, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {},
    });
    expect(matches('invideo-mcp-read-all', nameless)).toBe(false);
    expect(matches('invideo-mcp-write-all', nameless)).toBe(false);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    const noBody = makeRequest({ domain: DOMAIN, method: 'POST', path: PATH });
    expect(matches('invideo-mcp-session', noBody)).toBe(false);
    expect(matches('invideo-mcp-read-all', noBody)).toBe(false);
    expect(matches('invideo-mcp-write-all', noBody)).toBe(false);
  });
});
