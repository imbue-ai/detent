import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.evernote.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'search_notes',
  'semantic_search',
  'get_note',
  'get_attachment',
  'search_notebooks',
  'search_spaces',
  'get_space',
  'search_tags',
  'search_tasks',
  'get_task',
];

const WRITE_TOOLS = [
  'create_note',
  'edit_note',
  'update_note_tags',
  'move_notes',
  'restore_note',
  'start_attachment_upload',
  'finalize_attachment',
  'delete_note',
  'create_notebook',
  'rename_notebook',
  'move_notebook',
  'create_space',
  'create_tag',
  'edit_tag',
  'create_task',
  'update_task',
  'delete_task',
];

const FINE_GRAINED: Record<string, string[]> = {
  'evernote-mcp-read-notes': ['search_notes', 'semantic_search', 'get_note', 'get_attachment'],
  'evernote-mcp-write-notes': [
    'create_note',
    'edit_note',
    'update_note_tags',
    'move_notes',
    'restore_note',
    'start_attachment_upload',
    'finalize_attachment',
  ],
  'evernote-mcp-delete-notes': ['delete_note'],
  'evernote-mcp-read-notebooks': ['search_notebooks', 'search_spaces', 'get_space'],
  'evernote-mcp-write-notebooks': [
    'create_notebook',
    'rename_notebook',
    'move_notebook',
    'create_space',
  ],
  'evernote-mcp-read-tags': ['search_tags'],
  'evernote-mcp-write-tags': ['create_tag', 'edit_tag'],
  'evernote-mcp-read-tasks': ['search_tasks', 'get_task'],
  'evernote-mcp-write-tasks': ['create_task', 'update_task'],
  'evernote-mcp-delete-tasks': ['delete_task'],
};

describe('builtin schemas: evernote-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('evernote-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('evernote-mcp-api', makeRequest({ domain: 'accounts.evernote.com' }))).toBe(
      false
    );
    expect(matches('evernote-mcp-api', makeRequest({ domain: 'www.evernote.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('evernote-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('evernote-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('evernote-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('evernote-mcp-session', toolRequest('search_notes'))).toBe(false);
    expect(matches('evernote-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('evernote-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('evernote-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('evernote-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('evernote-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('evernote-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('evernote-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('evernote-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('evernote-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
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
      matches('evernote-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches(
        'evernote-mcp-read-notes',
        makeRequest({ domain: DOMAIN, method: 'POST', path: PATH })
      )
    ).toBe(false);
  });
});
