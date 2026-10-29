import { describe, it, expect } from 'vitest';
import {
  builtinRegistry,
  matches,
  mcpRequest,
  mcpRpc,
  mcpToolCall,
  makeRequest,
} from './helpers.js';

const DOMAIN = 'api.fathom.ai';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

// Fathom's hosted MCP server exposes read-only tools only, so there is no write-all schema.
const READ_TOOLS = [
  'list_meetings',
  'search_meetings',
  'find_person',
  'get_recording_by_url',
  'get_recording_by_call_id',
  'get_meeting_transcript',
  'get_meeting_summary',
  'get_identity',
  'list_teams',
];

const FINE_GRAINED: Record<string, string[]> = {
  'fathom-mcp-read-meetings': [
    'list_meetings',
    'search_meetings',
    'find_person',
    'get_recording_by_url',
    'get_recording_by_call_id',
  ],
  'fathom-mcp-read-transcripts': ['get_meeting_transcript'],
  'fathom-mcp-read-summaries': ['get_meeting_summary'],
  'fathom-mcp-read-account': ['get_identity', 'list_teams'],
};

describe('builtin schemas: fathom-mcp', () => {
  it('scope matches both MCP hosts only', () => {
    expect(matches('fathom-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('fathom-mcp-api', makeRequest({ domain: 'fathom.video' }))).toBe(true);
    expect(matches('fathom-mcp-api', makeRequest({ domain: 'app.fathom.video' }))).toBe(false);
    expect(matches('fathom-mcp-api', makeRequest({ domain: 'usefathom.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('fathom-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('fathom-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('fathom-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('fathom-mcp-session', toolRequest('list_meetings'))).toBe(false);
    expect(matches('fathom-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('read-all covers every tool and the handshake; there is no write-all', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('fathom-mcp-read-all', toolRequest(tool)), tool).toBe(true);
    }
    expect(matches('fathom-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('fathom-mcp-read-all', rpcRequest('tools/list'))).toBe(true);
    expect(matches('fathom-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('fathom-mcp-read-all', toolRequest('create_webhook'))).toBe(false);
    expect(builtinRegistry.get('fathom-mcp-write-all')).toBeUndefined();
  });

  it('fine-grained schemas match exactly their tools and cover every tool', () => {
    const covered = new Set(Object.values(FINE_GRAINED).flat());
    expect([...covered].sort()).toEqual([...READ_TOOLS].sort());
    for (const [schema, tools] of Object.entries(FINE_GRAINED)) {
      for (const tool of READ_TOOLS) {
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

  it('permission schemas also match the alternate host, since they do not pin the domain', () => {
    const viaVideoHost = mcpRequest('fathom.video', PATH, mcpToolCall('get_meeting_summary'));
    expect(matches('fathom-mcp-read-all', viaVideoHost)).toBe(true);
    expect(matches('fathom-mcp-read-summaries', viaVideoHost)).toBe(true);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('fathom-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches(
        'fathom-mcp-read-transcripts',
        makeRequest({ domain: DOMAIN, method: 'POST', path: PATH })
      )
    ).toBe(false);
  });
});
