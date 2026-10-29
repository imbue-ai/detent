import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.attio.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'list-objects',
  'search-records',
  'list-records',
  'get-records-by-ids',
  'list-attribute-definitions',
  'list-activities',
  'list-activity-attribute-definitions',
  'list-activity-records',
  'list-lists',
  'list-list-attribute-definitions',
  'list-records-in-list',
  'list-comments',
  'list-comment-replies',
  'search-notes-by-metadata',
  'semantic-search-notes',
  'get-note-body',
  'list-tasks',
  'search-meetings',
  'search-call-recordings-by-metadata',
  'semantic-search-call-recordings',
  'get-call-recording',
  'search-emails-by-metadata',
  'semantic-search-emails',
  'get-email-content',
  'list-workspace-members',
  'list-workspace-teams',
  'whoami',
  'run-basic-report',
  'query-particle-sql',
];

const WRITE_TOOLS = [
  'create-record',
  'upsert-record',
  'update-record',
  'merge-records',
  'create-activity-record',
  'update-activity-record',
  'upsert-activity-record',
  'create-list',
  'add-record-to-list',
  'update-list',
  'update-list-entry-by-id',
  'update-list-entry-by-record-id',
  'create-comment',
  'delete-comment',
  'create-note',
  'update-note',
  'create-task',
  'update-task',
  'delete-task',
];

const FINE_GRAINED: Record<string, { yes: string[]; no: string[] }> = {
  'attio-mcp-read-records': { yes: ['search-records', 'list-objects'], no: ['create-record'] },
  'attio-mcp-write-records': { yes: ['create-record', 'merge-records'], no: ['search-records'] },
  'attio-mcp-read-activities': { yes: ['list-activity-records'], no: ['create-activity-record'] },
  'attio-mcp-write-activities': { yes: ['upsert-activity-record'], no: ['list-activities'] },
  'attio-mcp-read-lists': { yes: ['list-records-in-list'], no: ['add-record-to-list'] },
  'attio-mcp-write-lists': { yes: ['create-list', 'update-list-entry-by-id'], no: ['list-lists'] },
  'attio-mcp-read-comments': { yes: ['list-comment-replies'], no: ['create-comment'] },
  'attio-mcp-write-comments': { yes: ['create-comment'], no: ['delete-comment'] },
  'attio-mcp-delete-comments': { yes: ['delete-comment'], no: ['create-comment'] },
  'attio-mcp-read-notes': { yes: ['semantic-search-notes', 'get-note-body'], no: ['create-note'] },
  'attio-mcp-write-notes': { yes: ['create-note', 'update-note'], no: ['get-note-body'] },
  'attio-mcp-read-tasks': { yes: ['list-tasks'], no: ['create-task'] },
  'attio-mcp-write-tasks': { yes: ['create-task', 'update-task'], no: ['delete-task'] },
  'attio-mcp-delete-tasks': { yes: ['delete-task'], no: ['update-task'] },
  'attio-mcp-read-meetings': {
    yes: ['search-meetings', 'get-call-recording'],
    no: ['get-email-content'],
  },
  'attio-mcp-read-emails': { yes: ['semantic-search-emails'], no: ['search-meetings'] },
  'attio-mcp-read-workspace': { yes: ['whoami', 'list-workspace-teams'], no: ['list-objects'] },
  'attio-mcp-run-reports': {
    yes: ['run-basic-report', 'query-particle-sql'],
    no: ['list-records'],
  },
};

describe('builtin schemas: attio-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('attio-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('attio-mcp-api', makeRequest({ domain: 'api.attio.com' }))).toBe(false);
    expect(matches('attio-mcp-api', makeRequest({ domain: 'app.attio.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('attio-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('attio-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('attio-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('attio-mcp-session', toolRequest('whoami'))).toBe(false);
    expect(matches('attio-mcp-session', toolRequest('create-record'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('attio-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('attio-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('attio-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('attio-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('attio-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('attio-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('attio-mcp-read-all', toolRequest('unknown-tool'))).toBe(false);
    expect(matches('attio-mcp-write-all', toolRequest('unknown-tool'))).toBe(false);
  });

  it('every tool is covered by a fine-grained schema', () => {
    for (const tool of [...READ_TOOLS, ...WRITE_TOOLS]) {
      const covering = Object.keys(FINE_GRAINED).filter((schema) =>
        matches(schema, toolRequest(tool))
      );
      expect(covering, tool).toHaveLength(1);
    }
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    for (const [schema, { yes, no }] of Object.entries(FINE_GRAINED)) {
      for (const tool of yes) {
        expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(true);
        expect(
          matches(schema, mcpRequest(DOMAIN, '/v1/other', mcpToolCall(tool))),
          `${schema} ${tool} wrong path`
        ).toBe(false);
      }
      for (const tool of no) {
        expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(false);
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
    }
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('attio-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches('attio-mcp-session', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches('attio-mcp-read-records', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
