import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'coda.io';
const PATH = '/apis/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'search',
  'name_match',
  'url_convert',
  'whoami',
  'tool_guide',
  'notifications_list',
  'document_outline',
  'schema_explain',
  'page_describe',
  'content_read',
  'page_read',
  'control_read',
  'table_rows_read',
  'table_columns_read',
  'formula_execute',
];

const WRITE_TOOLS = [
  'notifications_mark_read',
  'document_create',
  'document_manage',
  'page_create',
  'page_update',
  'content_modify',
  'content_duplicate',
  'content_image_upload',
  'document_suggest_changes',
  'control_manage',
  'control_delete',
  'allow_locked_page_edits',
  'document_delete',
  'page_delete',
  'table_create',
  'table_rows_manage',
  'table_columns_manage',
  'table_view_manage',
  'table_delete',
  'table_rows_delete',
  'table_columns_delete',
  'table_view_delete',
  'comment_add',
  'comment_resolve',
  'comment_delete',
  'comment_manage',
];

const FINE_GRAINED: Record<string, { yes: string[]; no: string[] }> = {
  'coda-mcp-read-workspace': { yes: ['search', 'whoami'], no: ['document_outline', 'page_update'] },
  'coda-mcp-read-notifications': { yes: ['notifications_list'], no: ['notifications_mark_read'] },
  'coda-mcp-write-notifications': { yes: ['notifications_mark_read'], no: ['notifications_list'] },
  'coda-mcp-read-docs': { yes: ['content_read', 'control_read'], no: ['content_modify', 'search'] },
  'coda-mcp-write-docs': {
    yes: ['page_update', 'document_manage'],
    no: ['page_delete', 'content_read'],
  },
  'coda-mcp-delete-docs': {
    yes: ['document_delete', 'page_delete'],
    no: ['table_delete', 'page_update'],
  },
  'coda-mcp-read-tables': { yes: ['table_rows_read'], no: ['table_rows_manage', 'content_read'] },
  'coda-mcp-write-tables': {
    yes: ['table_create', 'table_view_manage'],
    no: ['table_delete', 'table_rows_read'],
  },
  'coda-mcp-delete-tables': {
    yes: ['table_rows_delete', 'table_view_delete'],
    no: ['table_create', 'page_delete'],
  },
  'coda-mcp-write-comments': {
    yes: ['comment_add', 'comment_delete'],
    no: ['content_read', 'content_modify'],
  },
  'coda-mcp-run-formulas': { yes: ['formula_execute'], no: ['control_manage', 'table_rows_read'] },
};

describe('builtin schemas: coda-mcp', () => {
  it('scope matches the MCP hosts only', () => {
    expect(matches('coda-mcp-api', makeRequest({ domain: 'coda.io' }))).toBe(true);
    expect(matches('coda-mcp-api', makeRequest({ domain: 'docs.superhuman.com' }))).toBe(true);
    expect(matches('coda-mcp-api', makeRequest({ domain: 'help.superhuman.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('coda-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('coda-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('coda-mcp-session', rpcRequest('tools/call'))).toBe(false);
    expect(matches('coda-mcp-session', toolRequest('whoami'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('coda-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('coda-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('coda-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('coda-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('coda-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('coda-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('coda-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('coda-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
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
      expect(
        matches(schema, mcpRequest(DOMAIN, '/apis/v1/docs', mcpToolCall(yes[0]!))),
        schema
      ).toBe(false);
    }
  });

  it('permission schemas accept the successor host and trailing slash', () => {
    expect(
      matches(
        'coda-mcp-read-docs',
        mcpRequest('docs.superhuman.com', '/apis/mcp/', mcpToolCall('content_read'))
      )
    ).toBe(true);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('coda-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches('coda-mcp-session', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
