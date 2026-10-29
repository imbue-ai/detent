import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.trello.com';
const PATH = '/v1';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'trelloReadMember',
  'trelloReadWorkspace',
  'trelloReadBoard',
  'trelloReadList',
  'trelloReadCard',
  'trelloReadChecklist',
  'trelloSearch',
  'trelloReadInbox',
  'trelloReadPlanner',
];

const WRITE_TOOLS = [
  'trelloWriteBoard',
  'trelloWriteList',
  'trelloWriteCard',
  'trelloWriteChecklist',
  'trelloWriteInbox',
  'trelloWritePlanner',
];

const FINE_GRAINED: Record<string, string[]> = {
  'trello-mcp-read-profile': ['trelloReadMember'],
  'trello-mcp-read-boards': ['trelloReadWorkspace', 'trelloReadBoard', 'trelloReadList'],
  'trello-mcp-write-boards': ['trelloWriteBoard', 'trelloWriteList'],
  'trello-mcp-read-cards': ['trelloReadCard', 'trelloReadChecklist'],
  'trello-mcp-write-cards': ['trelloWriteCard', 'trelloWriteChecklist'],
  'trello-mcp-search': ['trelloSearch'],
  'trello-mcp-read-inbox': ['trelloReadInbox'],
  'trello-mcp-write-inbox': ['trelloWriteInbox'],
  'trello-mcp-read-planner': ['trelloReadPlanner'],
  'trello-mcp-write-planner': ['trelloWritePlanner'],
};

describe('builtin schemas: trello-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('trello-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('trello-mcp-api', makeRequest({ domain: 'api.trello.com' }))).toBe(false);
    expect(matches('trello-mcp-api', makeRequest({ domain: 'trello.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('trello-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('trello-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('trello-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('trello-mcp-session', rpcRequest('tools/call'))).toBe(false);
    expect(matches('trello-mcp-session', toolRequest('trelloReadBoard'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('trello-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('trello-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('trello-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('trello-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('trello-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('trello-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('trello-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('trello-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
  });

  it('every tool is covered by exactly one fine-grained schema', () => {
    const allTools = [...READ_TOOLS, ...WRITE_TOOLS];
    for (const tool of allTools) {
      const matching = Object.keys(FINE_GRAINED).filter((schema) =>
        matches(schema, toolRequest(tool))
      );
      expect(matching, tool).toHaveLength(1);
    }
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    for (const [schema, tools] of Object.entries(FINE_GRAINED)) {
      for (const tool of tools) {
        expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(true);
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
      expect(matches(schema, mcpRequest(DOMAIN, '/v2/mcp', mcpToolCall(tools[0]!))), schema).toBe(
        false
      );
    }
    expect(matches('trello-mcp-read-cards', toolRequest('trelloWriteCard'))).toBe(false);
    expect(matches('trello-mcp-write-cards', toolRequest('trelloReadCard'))).toBe(false);
    expect(matches('trello-mcp-read-boards', toolRequest('trelloSearch'))).toBe(false);
    expect(matches('trello-mcp-write-inbox', toolRequest('trelloWritePlanner'))).toBe(false);
  });

  it('permission schemas accept a trailing slash on the endpoint path', () => {
    expect(
      matches('trello-mcp-read-all', mcpRequest(DOMAIN, '/v1/', mcpToolCall('trelloReadBoard')))
    ).toBe(true);
    expect(
      matches('trello-mcp-read-all', mcpRequest(DOMAIN, '/v1/mcp', mcpToolCall('trelloReadBoard')))
    ).toBe(false);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    const noBody = makeRequest({ domain: DOMAIN, method: 'POST', path: PATH });
    expect(matches('trello-mcp-session', noBody)).toBe(false);
    expect(matches('trello-mcp-read-all', noBody)).toBe(false);
    expect(matches('trello-mcp-write-all', noBody)).toBe(false);
    expect(matches('trello-mcp-read-cards', noBody)).toBe(false);
  });
});
