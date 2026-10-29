import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.onepeloton.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = ['search', 'fetch', 'create-training-plan'];
const WRITE_TOOLS = ['schedule'];

const FINE_GRAINED: Record<string, string[]> = {
  'peloton-mcp-read-classes': ['search', 'fetch'],
  'peloton-mcp-create-training-plans': ['create-training-plan'],
  'peloton-mcp-schedule-classes': ['schedule'],
};

describe('builtin schemas: peloton-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('peloton-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('peloton-mcp-api', makeRequest({ domain: 'api.onepeloton.com' }))).toBe(false);
    expect(matches('peloton-mcp-api', makeRequest({ domain: 'members.onepeloton.com' }))).toBe(
      false
    );
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('peloton-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('peloton-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('peloton-mcp-session', rpcRequest('resources/read'))).toBe(true);
    expect(matches('peloton-mcp-session', toolRequest('search'))).toBe(false);
    expect(matches('peloton-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('peloton-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('peloton-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('peloton-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('peloton-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('peloton-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('peloton-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('peloton-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('peloton-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
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
      matches('peloton-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches(
        'peloton-mcp-schedule-classes',
        makeRequest({ domain: DOMAIN, method: 'POST', path: PATH })
      )
    ).toBe(false);
  });
});
