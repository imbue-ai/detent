import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.intercom.com';
const EU_DOMAIN = 'mcp.eu.intercom.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'search',
  'fetch',
  'search_conversations',
  'get_conversation',
  'search_contacts',
  'get_contact',
  'list_companies',
  'get_company',
  'list_articles',
  'search_articles',
  'get_article',
  'get_operator_response',
  'get_proposal_details',
];

const WRITE_TOOLS = [
  'create_article',
  'update_article',
  'add_internal_note',
  'send_operator_message',
  'apply_proposals',
  'reject_proposals',
];

const FINE_GRAINED: Record<string, string[]> = {
  'intercom-mcp-search': ['search', 'fetch'],
  'intercom-mcp-read-conversations': ['search_conversations', 'get_conversation'],
  'intercom-mcp-write-conversations': ['add_internal_note'],
  'intercom-mcp-read-contacts': ['search_contacts', 'get_contact'],
  'intercom-mcp-read-companies': ['list_companies', 'get_company'],
  'intercom-mcp-read-articles': ['list_articles', 'search_articles', 'get_article'],
  'intercom-mcp-write-articles': ['create_article', 'update_article'],
  'intercom-mcp-read-operator': ['get_operator_response', 'get_proposal_details'],
  'intercom-mcp-send-operator-messages': ['send_operator_message'],
  'intercom-mcp-write-operator-proposals': ['apply_proposals', 'reject_proposals'],
};

describe('builtin schemas: intercom-mcp', () => {
  it('scope matches the US and EU MCP hosts only', () => {
    expect(matches('intercom-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('intercom-mcp-api', makeRequest({ domain: EU_DOMAIN }))).toBe(true);
    expect(matches('intercom-mcp-api', makeRequest({ domain: 'api.intercom.io' }))).toBe(false);
    expect(matches('intercom-mcp-api', makeRequest({ domain: 'mcp.au.intercom.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('intercom-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('intercom-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('intercom-mcp-session', rpcRequest('ping'))).toBe(true);
    expect(matches('intercom-mcp-session', toolRequest('search'))).toBe(false);
    expect(matches('intercom-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('intercom-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('intercom-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('intercom-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('intercom-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('intercom-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('intercom-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('intercom-mcp-read-all', toolRequest('delete_article'))).toBe(false);
    expect(matches('intercom-mcp-write-all', toolRequest('delete_article'))).toBe(false);
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
      expect(
        matches(schema, mcpRequest(DOMAIN, '/sse', mcpToolCall(tools[0] ?? ''))),
        `${schema} on wrong path`
      ).toBe(false);
    }
  });

  it('permission schemas accept the EU host and the path with a trailing slash', () => {
    expect(
      matches('intercom-mcp-read-articles', mcpRequest(EU_DOMAIN, PATH, mcpToolCall('get_article')))
    ).toBe(true);
    expect(
      matches('intercom-mcp-read-articles', mcpRequest(DOMAIN, '/mcp/', mcpToolCall('get_article')))
    ).toBe(true);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('intercom-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches('intercom-mcp-session', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
