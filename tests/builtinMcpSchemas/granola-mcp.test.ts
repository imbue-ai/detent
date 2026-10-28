import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.granola.ai';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'query_granola_meetings',
  'list_meetings',
  'get_meetings',
  'get_meeting_attachment',
  'get_meeting_transcript',
  'list_meeting_folders',
  'get_account_info',
];

const WRITE_TOOLS = [
  'create_folder',
  'update_folder',
  'add_note_to_folder',
  'remove_note_from_folder',
  'switch_workspace',
  'sign_out',
];

const FINE_GRAINED: Record<string, { yes: string[]; no: string[] }> = {
  'granola-mcp-read-meetings': {
    yes: ['list_meetings', 'get_meetings', 'query_granola_meetings'],
    no: ['get_meeting_transcript', 'add_note_to_folder'],
  },
  'granola-mcp-read-transcripts': {
    yes: ['get_meeting_transcript'],
    no: ['get_meetings', 'list_meetings'],
  },
  'granola-mcp-read-folders': {
    yes: ['list_meeting_folders'],
    no: ['create_folder', 'list_meetings'],
  },
  'granola-mcp-write-folders': {
    yes: ['create_folder', 'add_note_to_folder', 'remove_note_from_folder'],
    no: ['list_meeting_folders', 'get_meetings'],
  },
  'granola-mcp-read-account': {
    yes: ['get_account_info'],
    no: ['switch_workspace', 'sign_out'],
  },
  'granola-mcp-switch-workspaces': {
    yes: ['switch_workspace'],
    no: ['get_account_info', 'sign_out'],
  },
  'granola-mcp-sign-out': {
    yes: ['sign_out'],
    no: ['get_account_info', 'switch_workspace'],
  },
};

describe('builtin schemas: granola-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('granola-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('granola-mcp-api', makeRequest({ domain: 'mcp-auth.granola.ai' }))).toBe(false);
    expect(matches('granola-mcp-api', makeRequest({ domain: 'api.granola.ai' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('granola-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('granola-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('granola-mcp-session', rpcRequest('tools/call'))).toBe(false);
    expect(matches('granola-mcp-session', toolRequest('get_account_info'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('granola-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('granola-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('granola-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('granola-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('granola-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('granola-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('granola-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('granola-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
  });

  it('every tool is covered by at least one fine-grained schema', () => {
    for (const tool of [...READ_TOOLS, ...WRITE_TOOLS]) {
      const covered = Object.keys(FINE_GRAINED).some((schema) =>
        matches(schema, toolRequest(tool))
      );
      expect(covered, tool).toBe(true);
    }
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    for (const [schema, { yes, no }] of Object.entries(FINE_GRAINED)) {
      for (const tool of yes) {
        expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(true);
      }
      for (const tool of no) {
        expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(false);
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
      expect(matches(schema, mcpRequest(DOMAIN, '/v1/other', mcpToolCall(yes[0]!))), schema).toBe(
        false
      );
    }
  });

  it('permission schemas accept a trailing slash on the endpoint path', () => {
    expect(
      matches('granola-mcp-read-meetings', mcpRequest(DOMAIN, '/mcp/', mcpToolCall('get_meetings')))
    ).toBe(true);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('granola-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches('granola-mcp-session', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
